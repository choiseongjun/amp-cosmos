package keeper

import (
    "cosmossdk.io/collections"
    "cosmossdk.io/core/address"
    corestore "cosmossdk.io/core/store"
    "github.com/cosmos/cosmos-sdk/codec"

    "amp/x/points/types"
)

type Keeper struct {
    storeService corestore.KVStoreService
    cdc          codec.Codec
    addressCodec address.Codec

    Schema collections.Schema
    Scores collections.Map[string, int64]
}

func NewKeeper(
    storeService corestore.KVStoreService,
    cdc codec.Codec,
    addressCodec address.Codec,
) Keeper {
    sb := collections.NewSchemaBuilder(storeService)

    k := Keeper{
        storeService: storeService,
        cdc:          cdc,
        addressCodec: addressCodec,
        Scores:       collections.NewMap(sb, types.ScoresPrefix, "scores", collections.StringKey, collections.Int64Value),
    }

    schema, err := sb.Build()
    if err != nil {
        panic(err)
    }
    k.Schema = schema
    return k
}

