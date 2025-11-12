package types

import (
    sdkerrors "cosmossdk.io/errors"
)

var (
    ErrUnauthorized = sdkerrors.Register(ModuleName, 1, "unauthorized")
)

