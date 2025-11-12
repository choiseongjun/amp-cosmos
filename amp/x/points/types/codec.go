package types

import (
    "github.com/cosmos/cosmos-sdk/codec"
    codectypes "github.com/cosmos/cosmos-sdk/codec/types"
    "github.com/cosmos/cosmos-sdk/types/msgservice"
)

// ModuleCdc references the global x/points module codec.
var ModuleCdc = codec.NewProtoCodec(nil)

func RegisterInterfaces(registry codectypes.InterfaceRegistry) {
    // Messages registered via protobuf service definitions.
    msgservice.RegisterMsgServiceDesc(registry, &_Msg_serviceDesc)
    RegisterQueryService(registry)
}

// RegisterQueryService is separated to avoid linter complaints when descriptors are missing at authoring time.
func RegisterQueryService(registry codectypes.InterfaceRegistry) {
    // Query service registration happens via generated descriptors at compile-time.
}

