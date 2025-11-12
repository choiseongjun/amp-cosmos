package types

import "cosmossdk.io/collections"

const (
    ModuleName = "points"
    StoreKey   = ModuleName
    GovModuleName = "gov"
)

var (
    ParamsKey = collections.NewPrefix("p_points")
    ScoresPrefix = collections.NewPrefix("s_points")
)

