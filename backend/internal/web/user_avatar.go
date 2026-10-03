package web

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"

	"github.com/gtsteffaniak/filebrowser/backend/internal/state"
	xdraw "golang.org/x/image/draw"
	"golang.org/x/image/webp"
)

const avatarMaxUpload = 2 << 20
const avatarMaxStored = 256 << 10

func requestedAvatarUser(r *http.Request, d *Context) (uint64, error) {
	name := r.URL.Query().Get("username")
	if name == "" {
		return 0, fmt.Errorf("username query parameter is required")
	}
	u, err := state.GetUserByUsername(name)
	if err != nil {
		return 0, fmt.Errorf("user not found")
	}
	if u.ID != d.User.ID && !d.User.Permissions.Admin {
		return 0, fmt.Errorf("you are not allowed to change this avatar")
	}
	return u.ID, nil
}

// @Summary Get a user's avatar
// @Tags Users
// @Produce image/jpeg
// @Param username query string true "Username"
// @Success 200 {file} binary
// @Failure 304 "Avatar unchanged"
// @Failure 404 "No avatar"
// @Router /api/users/avatar [get]
func userAvatarGetHandler(w http.ResponseWriter, r *http.Request, d *Context) (int, error) {
	u, err := state.GetUserByUsername(r.URL.Query().Get("username"))
	if err != nil {
		return http.StatusNotFound, err
	}
	a, err := state.GetUserAvatar(u.ID)
	if err != nil {
		return http.StatusNotFound, fmt.Errorf("avatar not found")
	}
	w.Header().Set("ETag", `"`+a.Hash+`"`)
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.Header().Set("Content-Type", "image/jpeg")
	if r.Header.Get("If-None-Match") == `"`+a.Hash+`"` || r.Header.Get("If-None-Match") == a.Hash {
		return http.StatusNotModified, nil
	}
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(a.Image)
	return http.StatusOK, err
}

// @Summary Upload or replace a user's avatar
// @Tags Users
// @Accept multipart/form-data
// @Produce json
// @Param username query string true "Username"
// @Param avatar formData file true "JPEG, PNG, or WebP image"
// @Success 200 {object} map[string]string
// @Router /api/users/avatar [put]
func userAvatarPutHandler(w http.ResponseWriter, r *http.Request, d *Context) (int, error) {
	id, err := requestedAvatarUser(r, d)
	if err != nil {
		return http.StatusForbidden, err
	}
	r.Body = http.MaxBytesReader(w, r.Body, avatarMaxUpload)
	f, _, err := r.FormFile("avatar")
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return http.StatusRequestEntityTooLarge, fmt.Errorf("avatar exceeds 2 MB")
		}
		return http.StatusBadRequest, fmt.Errorf("avatar file is required")
	}
	defer f.Close()
	b, err := io.ReadAll(f)
	if err != nil {
		return http.StatusRequestEntityTooLarge, fmt.Errorf("avatar exceeds 2 MB")
	}
	if len(b) == 0 {
		return http.StatusBadRequest, fmt.Errorf("avatar is empty")
	}
	// Content sniffing rejects SVG and polyglots before the real decoder validates them.
	mime := http.DetectContentType(b)
	if mime != "image/jpeg" && mime != "image/png" && mime != "image/webp" {
		return http.StatusUnsupportedMediaType, fmt.Errorf("avatar must be JPEG, PNG, or WebP")
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(b))
	if err != nil {
		return http.StatusBadRequest, fmt.Errorf("invalid image")
	}
	if config.Width > 4096 || config.Height > 4096 || config.Width < 1 || config.Height < 1 {
		return http.StatusBadRequest, fmt.Errorf("image dimensions exceed 4096 pixels")
	}
	img, _, err := image.Decode(bytes.NewReader(b))
	if err != nil {
		return http.StatusBadRequest, fmt.Errorf("invalid image")
	}
	min := img.Bounds().Dx()
	if img.Bounds().Dy() < min {
		min = img.Bounds().Dy()
	}
	x := (img.Bounds().Dx() - min) / 2
	y := (img.Bounds().Dy() - min) / 2
	crop := image.NewRGBA(image.Rect(0, 0, 256, 256))
	xdraw.CatmullRom.Scale(crop, crop.Bounds(), img, image.Rect(x, y, x+min, y+min), draw.Over, nil)
	var out bytes.Buffer
	quality := 85
	for {
		out.Reset()
		if err = jpeg.Encode(&out, crop, &jpeg.Options{Quality: quality}); err != nil {
			return http.StatusInternalServerError, err
		}
		if out.Len() <= avatarMaxStored {
			break
		}
		quality -= 10
		if quality < 35 {
			return http.StatusBadRequest, fmt.Errorf("processed avatar exceeds 256 KB")
		}
	}
	encoded := out.Bytes()
	sum := sha256.Sum256(encoded)
	hash := hex.EncodeToString(sum[:])
	if err = state.SaveUserAvatar(id, hash, encoded); err != nil {
		return http.StatusInternalServerError, fmt.Errorf("could not save avatar")
	}
	return RenderJSON(w, r, map[string]string{"avatarUrl": "/api/users/avatar?username=" + r.URL.Query().Get("username") + "&v=" + hash, "avatarHash": hash})
}

// @Summary Delete a user's avatar
// @Tags Users
// @Param username query string true "Username"
// @Success 200 "Avatar deleted"
// @Router /api/users/avatar [delete]
func userAvatarDeleteHandler(w http.ResponseWriter, r *http.Request, d *Context) (int, error) {
	id, err := requestedAvatarUser(r, d)
	if err != nil {
		return http.StatusForbidden, err
	}
	if err = state.DeleteUserAvatar(id); err != nil {
		return http.StatusInternalServerError, err
	}
	return http.StatusOK, nil
}

var _ image.Image
var _ = webp.Decode
