package types

import sdkmath "cosmossdk.io/math"

// NewParams creates a new Params instance.
func NewParams() Params {
    return Params{CommissionRate: ZeroDec()}
}

// DefaultParams returns a default set of parameters.
func DefaultParams() Params {
    return NewParams()
}

// Validate validates the set of params.
func (p Params) Validate() error {
    // CommissionRate must be in [0,1]
    if p.CommissionRate.IsNegative() {
        return ErrInvalidCommissionRate
    }
    if p.CommissionRate.GT(OneDec()) {
        return ErrInvalidCommissionRate
    }
    return nil
}

// helpers for decimals without importing sdk.Dec directly in generated types
func ZeroDec() sdkmath.LegacyDec { return sdkmath.LegacyNewDec(0) }
func OneDec() sdkmath.LegacyDec  { return sdkmath.LegacyNewDec(1) }
