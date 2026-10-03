package web

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strings"
	"testing"
)

// This inventory test inspects every route registered on publicApi. Share content routes
// must call the common hash middleware; the information route must call the same account gate.
func TestEveryPublicShareContentRouteChecksRestrictedAccess(t *testing.T) {
	filename := "httpRouter.go"
	src, err := os.ReadFile(filename)
	if err != nil {
		t.Fatal(err)
	}
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filename, src, 0)
	if err != nil {
		t.Fatal(err)
	}
	checks := map[string]bool{}
	var inspectExpr func(ast.Node, func(*ast.Ident))
	inspectExpr = func(n ast.Node, visit func(*ast.Ident)) {
		ast.Inspect(n, func(node ast.Node) bool {
			if id, ok := node.(*ast.Ident); ok {
				visit(id)
			}
			return true
		})
	}
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Name.Name != "configureHTTPRouter" {
			continue
		}
		ast.Inspect(fn.Body, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			sel, ok := call.Fun.(*ast.SelectorExpr)
			if !ok || sel.Sel.Name != "HandleFunc" {
				return true
			}
			recv, ok := sel.X.(*ast.Ident)
			if !ok || recv.Name != "publicApi" || len(call.Args) < 2 {
				return true
			}
			lit, ok := call.Args[0].(*ast.BasicLit)
			if !ok {
				return true
			}
			pattern := strings.Trim(lit.Value, "\"")
			if !(strings.Contains(pattern, "/resources") || strings.Contains(pattern, "/raw") || strings.Contains(pattern, "/media/") || strings.Contains(pattern, "/office/") || pattern == "GET /share/info" || pattern == "GET /share/image") {
				return true
			}
			wrapped := false
			info := false
			inspectExpr(call.Args[1], func(id *ast.Ident) {
				if id.Name == "withHashFile" || id.Name == "withHashFileHelper" {
					wrapped = true
				}
				if id.Name == "shareInfoHandler" {
					info = true
				}
			})
			if pattern == "GET /share/info" {
				checks[pattern] = info
			} else {
				checks[pattern] = wrapped
			}
			return true
		})
	}
	for _, required := range []string{"GET /resources", "GET /resources/items", "GET /resources/download", "GET /resources/view", "GET /resources/preview", "GET /raw", "GET /media/stream", "GET /media/metadata", "GET /media/subtitles", "GET /share/info", "GET /share/image"} {
		if ok, exists := checks[required]; !exists || !ok {
			t.Errorf("public route %q is missing restricted-share authorization middleware", required)
		}
	}
	for route, ok := range checks {
		if !ok {
			t.Errorf("public route %q bypasses restricted-share authorization", route)
		}
	}
	// Keep the helper visible to this audit so moving the gate out of shareInfoHandler fails loudly.
	shareSource, err := os.ReadFile("share.go")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(shareSource), "restrictedShareUserAllowed(shareInfo") {
		t.Fatal("shareInfoHandler authorization helper was removed")
	}
}
