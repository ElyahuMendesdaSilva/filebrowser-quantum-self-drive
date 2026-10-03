package web

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"testing"

	"github.com/gtsteffaniak/filebrowser/backend/internal/database/users"
	"github.com/gtsteffaniak/filebrowser/backend/internal/state"
)

func avatarMultipart(t *testing.T, filename, contentType string, payload []byte) (*bytes.Buffer, string) {
	t.Helper()
	body := new(bytes.Buffer)
	writer := multipart.NewWriter(body)
	h := textproto.MIMEHeader{}
	h.Set("Content-Disposition", `form-data; name="avatar"; filename="`+filename+`"`)
	h.Set("Content-Type", contentType)
	part, err := writer.CreatePart(h)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = part.Write(payload); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	return body, writer.FormDataContentType()
}

func TestAvatarUploadNormalizeETagAndDelete(t *testing.T) {
	setupTestEnv(t)
	user := &users.User{FrontendUser: users.FrontendUser{Username: "avatar-user"}}
	if err := state.CreateUser(user, ""); err != nil {
		t.Fatal(err)
	}
	stored, err := state.GetUserByUsername(user.Username)
	if err != nil {
		t.Fatal(err)
	}
	ctx := &Context{User: &stored}
	for _, kind := range []string{"jpeg", "png", "webp"} {
		var encoded bytes.Buffer
		filename, contentType := "test.jpg", "image/jpeg"
		if kind == "webp" {
			payload, err := os.ReadFile("testdata_avatar.webp")
			if err != nil {
				t.Fatal(err)
			}
			encoded.Write(payload)
			filename, contentType = "test.webp", "image/webp"
		} else {
			input := image.NewRGBA(image.Rect(0, 0, 320, 180))
			for y := 0; y < 180; y++ {
				for x := 0; x < 320; x++ {
					input.Set(x, y, color.RGBA{uint8(x % 255), uint8(y % 255), 120, 255})
				}
			}
			if kind == "jpeg" {
				err = jpeg.Encode(&encoded, input, &jpeg.Options{Quality: 90})
			} else {
				filename, contentType = "test.png", "image/png"
				err = png.Encode(&encoded, input)
			}
			if err != nil {
				t.Fatal(err)
			}
			if kind == "jpeg" {
				withExif := append([]byte(nil), encoded.Bytes()[:2]...)
				withExif = append(withExif, []byte{0xff, 0xe1, 0x00, 0x0e, 'E', 'x', 'i', 'f', 0, 0, 1, 2, 3, 4, 5, 6}...)
				withExif = append(withExif, encoded.Bytes()[2:]...)
				encoded.Reset()
				encoded.Write(withExif)
			}
		}
		body, formType := avatarMultipart(t, filename, contentType, encoded.Bytes())
		req := httptest.NewRequest(http.MethodPut, "/api/users/avatar?username="+user.Username, body)
		req.Header.Set("Content-Type", formType)
		w := httptest.NewRecorder()
		status, _ := userAvatarPutHandler(w, req, ctx)
		if status != http.StatusOK {
			t.Fatalf("%s upload status=%d body=%s", kind, status, w.Body.String())
		}
		a, err := state.GetUserAvatar(stored.ID)
		if err != nil {
			t.Fatal(err)
		}
		cfg, format, err := image.DecodeConfig(bytes.NewReader(a.Image))
		if err != nil {
			t.Fatal(err)
		}
		if cfg.Width != 256 || cfg.Height != 256 || format != "jpeg" {
			t.Fatalf("processed image = %dx%d %s", cfg.Width, cfg.Height, format)
		}
		if len(a.Image) > avatarMaxStored || a.Hash == "" {
			t.Fatalf("invalid stored image size/hash: %d %q", len(a.Image), a.Hash)
		}
		if bytes.Contains(a.Image, []byte("Exif")) {
			t.Fatal("processed avatar retained EXIF marker")
		}
		get := httptest.NewRequest(http.MethodGet, "/api/users/avatar?username="+user.Username, nil)
		get.Header.Set("If-None-Match", `"`+a.Hash+`"`)
		getW := httptest.NewRecorder()
		got, _ := userAvatarGetHandler(getW, get, ctx)
		if got != http.StatusNotModified {
			t.Fatalf("conditional GET status=%d", got)
		}
	}
	other := &users.User{FrontendUser: users.FrontendUser{Username: "avatar-other"}}
	if err = state.CreateUser(other, ""); err != nil {
		t.Fatal(err)
	}
	body, formType := avatarMultipart(t, "fake.jpg", "image/jpeg", []byte("not an image"))
	req := httptest.NewRequest(http.MethodPut, "/api/users/avatar?username="+other.Username, body)
	req.Header.Set("Content-Type", formType)
	w := httptest.NewRecorder()
	status, _ := userAvatarPutHandler(w, req, ctx)
	if status != http.StatusForbidden {
		t.Fatalf("cross-user upload status=%d", status)
	}
	body, formType = avatarMultipart(t, "fake.jpg", "image/jpeg", []byte("<svg/>"))
	req = httptest.NewRequest(http.MethodPut, "/api/users/avatar?username="+user.Username, body)
	req.Header.Set("Content-Type", formType)
	w = httptest.NewRecorder()
	status, _ = userAvatarPutHandler(w, req, ctx)
	if status != http.StatusUnsupportedMediaType {
		t.Fatalf("SVG content status=%d", status)
	}
	body, formType = avatarMultipart(t, "corrupt.jpg", "image/jpeg", []byte{0xff, 0xd8, 0xff, 0xd9})
	req = httptest.NewRequest(http.MethodPut, "/api/users/avatar?username="+user.Username, body)
	req.Header.Set("Content-Type", formType)
	w = httptest.NewRecorder()
	status, _ = userAvatarPutHandler(w, req, ctx)
	if status != http.StatusBadRequest {
		t.Fatalf("corrupt JPEG status=%d", status)
	}
	body, formType = avatarMultipart(t, "large.jpg", "image/jpeg", bytes.Repeat([]byte{'x'}, avatarMaxUpload))
	req = httptest.NewRequest(http.MethodPut, "/api/users/avatar?username="+user.Username, body)
	req.Header.Set("Content-Type", formType)
	w = httptest.NewRecorder()
	status, _ = userAvatarPutHandler(w, req, ctx)
	if status != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversize upload status=%d", status)
	}
	large := image.NewRGBA(image.Rect(0, 0, 4097, 1))
	var big bytes.Buffer
	if err = png.Encode(&big, large); err != nil {
		t.Fatal(err)
	}
	body, formType = avatarMultipart(t, "too-wide.png", "image/png", big.Bytes())
	req = httptest.NewRequest(http.MethodPut, "/api/users/avatar?username="+user.Username, body)
	req.Header.Set("Content-Type", formType)
	w = httptest.NewRecorder()
	status, _ = userAvatarPutHandler(w, req, ctx)
	if status != http.StatusBadRequest {
		t.Fatalf("oversize dimensions status=%d", status)
	}
	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/users/avatar?username="+user.Username, nil)
	deleteW := httptest.NewRecorder()
	status, _ = userAvatarDeleteHandler(deleteW, deleteReq, ctx)
	if status != http.StatusOK {
		t.Fatalf("delete status=%d", status)
	}
	if _, err = state.GetUserAvatar(stored.ID); err == nil {
		t.Fatal("avatar remains after delete")
	}
	missingReq := httptest.NewRequest(http.MethodGet, "/api/users/avatar?username="+user.Username, nil)
	missingW := httptest.NewRecorder()
	status, _ = userAvatarGetHandler(missingW, missingReq, ctx)
	if status != http.StatusNotFound {
		t.Fatalf("missing avatar status=%d", status)
	}
	if err = state.SaveUserAvatar(stored.ID, "cleanup-test", []byte("avatar")); err != nil {
		t.Fatal(err)
	}
	if err = state.DeleteUser(stored.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = state.GetUserAvatar(stored.ID); err == nil {
		t.Fatal("avatar remains after deleting user")
	}
}
