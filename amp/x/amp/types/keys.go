package types

import "cosmossdk.io/collections"

const (
    // ModuleName defines the module name
    ModuleName = "amp"

	// StoreKey defines the primary module store key
	StoreKey = ModuleName

    // GovModuleName duplicates the gov module's name to avoid a dependency with x/gov.
	// It should be synced with the gov module's name if it is ever changed.
	// See: https://github.com/cosmos/cosmos-sdk/blob/v0.52.0-beta.2/x/gov/types/keys.go#L9
    GovModuleName = "gov"

    // EscrowModuleName is the name used to derive the escrow module account address
    EscrowModuleName = ModuleName + "_escrow"
)

// ParamsKey is the prefix to retrieve all Params
var ParamsKey = collections.NewPrefix("p_amp")

// ListingsPrefix is the prefix to store all Listing objects
var ListingsPrefix = collections.NewPrefix("l_amp")

// ListingSeqKey stores the auto-incrementing ID for listings
var ListingSeqKey = collections.NewPrefix("lseq_amp")
