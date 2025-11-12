package sonic

import (
    "encoding/json"
)

// Marshal proxies to the standard library json.Marshal to avoid
// cgo/asm/linkname usage from the upstream sonic package.
func Marshal(v any) ([]byte, error) {
    return json.Marshal(v)
}

// Unmarshal proxies to the standard library json.Unmarshal.
func Unmarshal(data []byte, v any) error {
    return json.Unmarshal(data, v)
}

