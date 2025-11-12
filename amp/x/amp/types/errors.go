package types

// DONTCOVER

import (
	"cosmossdk.io/errors"
)

// x/amp module sentinel errors
var (
    ErrInvalidSigner = errors.Register(ModuleName, 1100, "expected gov account as only signer for proposal message")
    ErrListingNotActive = errors.Register(ModuleName, 1101, "listing is not active")
    ErrSelfPurchase     = errors.Register(ModuleName, 1102, "seller cannot buy own listing")
    ErrUnauthorized     = errors.Register(ModuleName, 1103, "unauthorized action")
    ErrInvalidCommissionRate = errors.Register(ModuleName, 1104, "commission_rate must be between 0 and 1")
)
