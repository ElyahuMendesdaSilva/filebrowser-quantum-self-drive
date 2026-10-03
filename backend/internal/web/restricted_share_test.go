package web

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gtsteffaniak/filebrowser/backend/internal/database/share"
	"github.com/gtsteffaniak/filebrowser/backend/internal/database/users"
	"github.com/gtsteffaniak/filebrowser/backend/internal/state"
)

func TestRestrictedShareUserGate(t *testing.T) {
	setupTestEnv(t)
	ownerRecord := &users.User{FrontendUser: users.FrontendUser{Username: "gate-owner"}}
	if err := state.CreateUser(ownerRecord, ""); err != nil {
		t.Fatal(err)
	}
	ownerLoaded, err := state.GetUserByUsername(ownerRecord.Username)
	if err != nil {
		t.Fatal(err)
	}
	allowed := &users.User{ID: 2, FrontendUser: users.FrontendUser{Username: "alice"}}
	denied := &users.User{ID: 3, FrontendUser: users.FrontendUser{Username: "bob"}}
	admin := &users.User{ID: 4, FrontendUser: users.FrontendUser{Username: "admin", Permissions: users.Permissions{Admin: true}}}
	link := share.Share{ShareColumns: share.ShareColumns{Hash: "restricted_gate"}, ShareLimits: share.ShareLimits{AllowedUsernames: []string{"alice"}}}
	link.UserID = ownerLoaded.ID
	owner := &ownerLoaded
	if !restrictedShareUserAllowed(link, owner) {
		t.Fatal("share owner denied")
	}
	if restrictedShareUserAllowed(link, allowed) == false {
		t.Fatal("allowed username denied")
	}
	if restrictedShareUserAllowed(link, denied) {
		t.Fatal("unlisted user allowed")
	}
	if restrictedShareUserAllowed(link, nil) {
		t.Fatal("anonymous user allowed")
	}
	if !restrictedShareUserAllowed(link, admin) {
		t.Fatal("admin denied")
	}
	link.AllowedUsernames = nil
	if !restrictedShareUserAllowed(link, nil) {
		t.Fatal("unrestricted share changed behavior")
	}
}

func TestUserSearchReturnsOnlySelectorFields(t *testing.T) {
	setupTestEnv(t)
	user := &users.User{FrontendUser: users.FrontendUser{Username: "search-alice", Permissions: users.Permissions{Share: true}}}
	if err := state.CreateUser(user, ""); err != nil {
		t.Fatal(err)
	}
	loaded, err := state.GetUserByUsername(user.Username)
	if err != nil {
		t.Fatal(err)
	}
	if err = state.UpdateUser(&users.User{ID: loaded.ID, FrontendUser: users.FrontendUser{Permissions: users.Permissions{Share: true}}}, "", "permissions"); err != nil {
		t.Fatal(err)
	}
	loaded, err = state.GetUserByUsername(user.Username)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/users?q=alice", nil)
	w := httptest.NewRecorder()
	status, _ := userGetHandler(w, req, &Context{User: &loaded})
	if status != http.StatusOK {
		t.Fatalf("search status=%d", status)
	}
	var results []map[string]json.RawMessage
	if err = json.Unmarshal(w.Body.Bytes(), &results); err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 {
		t.Fatalf("results=%s", w.Body.String())
	}
	if len(results[0]) != 2 || results[0]["username"] == nil || results[0]["avatarUrl"] == nil {
		t.Fatalf("selector exposed unexpected fields: %s", w.Body.String())
	}
	loaded.Permissions.Share = false
	req = httptest.NewRequest(http.MethodGet, "/api/users?q=alice", nil)
	w = httptest.NewRecorder()
	status, _ = userGetHandler(w, req, &Context{User: &loaded})
	if status != http.StatusForbidden {
		t.Fatalf("search without share permission status=%d", status)
	}
}

func TestRestrictedShareInfoHidesDetailsUntilAuthorized(t *testing.T) {
	setupTestEnv(t)
	owner := &users.User{FrontendUser: users.FrontendUser{Username: "info-owner"}}
	allowed := &users.User{FrontendUser: users.FrontendUser{Username: "info-allowed"}}
	outsider := &users.User{FrontendUser: users.FrontendUser{Username: "info-outsider"}}
	for _, u := range []*users.User{owner, allowed, outsider} {
		if err := state.CreateUser(u, ""); err != nil {
			t.Fatal(err)
		}
	}
	owner, err := userByNameForTest(t, owner.Username)
	if err != nil {
		t.Fatal(err)
	}
	allowed, err = userByNameForTest(t, allowed.Username)
	if err != nil {
		t.Fatal(err)
	}
	outsider, err = userByNameForTest(t, outsider.Username)
	if err != nil {
		t.Fatal(err)
	}
	link := &share.Share{ShareSettings: share.ShareSettings{FrontendShareInfo: share.FrontendShareInfo{ShareType: "normal", Title: "sensitive title"}, ShareLimits: share.ShareLimits{AllowedUsernames: []string{allowed.Username}}}, ShareColumns: share.ShareColumns{Hash: "restricted-info-test", Path: "/secret.txt"}, UserID: owner.ID, SourcePath: "/srv"}
	if err := state.CreateShare(link); err != nil {
		t.Fatal(err)
	}
	call := func(user *users.User) (int, *httptest.ResponseRecorder) {
		req := httptest.NewRequest(http.MethodGet, "/public/api/share/info?hash="+link.Hash, nil)
		w := httptest.NewRecorder()
		status, _ := shareInfoHandler(w, req, &Context{User: user})
		return status, w
	}
	status, w := call(&users.User{FrontendUser: users.FrontendUser{Username: "anonymous"}})
	if status != http.StatusOK {
		t.Fatalf("anonymous info status=%d", status)
	}
	var hidden map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &hidden); err != nil {
		t.Fatal(err)
	}
	if len(hidden) != 1 || hidden["restricted"] == nil {
		t.Fatalf("restricted anonymous response leaked fields: %s", w.Body.String())
	}
	status, _ = call(outsider)
	if status != http.StatusForbidden {
		t.Fatalf("outsider info status=%d", status)
	}
	status, w = call(allowed)
	if status != http.StatusOK {
		t.Fatalf("allowed info status=%d", status)
	}
	var visible map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &visible); err != nil {
		t.Fatal(err)
	}
	if string(visible["username"]) != `"info-owner"` {
		t.Fatalf("owner username missing: %s", w.Body.String())
	}
}

func TestRestrictedShareContentRequiresLoginAndRejectsOutsider(t *testing.T) {
	owner, outsider, _ := setupShareAuthTestUsers(t)
	link := &share.Share{ShareSettings: share.ShareSettings{FrontendShareInfo: share.FrontendShareInfo{ShareType: "normal"}, ShareLimits: share.ShareLimits{SourceName: "srv", AllowedUsernames: []string{owner.Username}}}, ShareColumns: share.ShareColumns{Hash: "private-content-gate", Path: "/"}, SourcePath: "/srv", UserID: owner.ID}
	if err := state.CreateShare(link); err != nil {
		t.Fatal(err)
	}
	call := func(token string) int {
		req := httptest.NewRequest(http.MethodGet, "/resources?hash="+link.Hash, nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		withHashFile(publicGetResourceHandler).ServeHTTP(w, req)
		return w.Code
	}
	if status := call(""); status != http.StatusUnauthorized {
		t.Fatalf("anonymous share content status=%d", status)
	}
	if status := call(testSessionToken(t, outsider, time.Hour)); status != http.StatusForbidden {
		t.Fatalf("outsider share content status=%d", status)
	}
}

func userByNameForTest(t *testing.T, name string) (*users.User, error) {
	t.Helper()
	u, err := state.GetUserByUsername(name)
	if err != nil {
		return nil, err
	}
	return &u, nil
}
