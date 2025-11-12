package points

import (
    "context"
    "encoding/json"

    "cosmossdk.io/core/appmodule"
    "github.com/cosmos/cosmos-sdk/client"
    "github.com/cosmos/cosmos-sdk/codec"
    codectypes "github.com/cosmos/cosmos-sdk/codec/types"
    sdk "github.com/cosmos/cosmos-sdk/types"
    "github.com/cosmos/cosmos-sdk/types/module"
    "github.com/grpc-ecosystem/grpc-gateway/runtime"
    "google.golang.org/grpc"

    "amp/x/points/keeper"
    "amp/x/points/types"
)

var (
    _ module.AppModuleBasic = (*AppModule)(nil)
    _ module.AppModule      = (*AppModule)(nil)
    _ appmodule.AppModule   = (*AppModule)(nil)
    _ module.HasGenesis     = (*AppModule)(nil)
)

type AppModule struct {
    cdc    codec.Codec
    keeper keeper.Keeper
}

func NewAppModule(cdc codec.Codec, k keeper.Keeper) AppModule { return AppModule{cdc: cdc, keeper: k} }
func (AppModule) IsAppModule()                       {}
func (AppModule) Name() string                       { return types.ModuleName }
func (AppModule) RegisterLegacyAminoCodec(*codec.LegacyAmino) {}
func (AppModule) RegisterGRPCGatewayRoutes(clientCtx client.Context, mux *runtime.ServeMux) {
    if err := types.RegisterQueryHandlerClient(clientCtx.CmdContext, mux, types.NewQueryClient(clientCtx)); err != nil { panic(err) }
}
func (AppModule) RegisterInterfaces(r codectypes.InterfaceRegistry) { types.RegisterInterfaces(r) }
func (am AppModule) RegisterServices(registrar grpc.ServiceRegistrar) error {
    types.RegisterMsgServer(registrar, keeper.NewMsgServerImpl(am.keeper))
    types.RegisterQueryServer(registrar, keeper.NewQueryServerImpl(am.keeper))
    return nil
}
func (AppModule) BeginBlock(context.Context) error { return nil }
func (AppModule) EndBlock(context.Context) error   { return nil }

// Minimal genesis wiring (no state for now).
func (am AppModule) DefaultGenesis(codec.JSONCodec) json.RawMessage { return json.RawMessage("{}") }
func (AppModule) ValidateGenesis(_ codec.JSONCodec, _ client.TxEncodingConfig, _ json.RawMessage) error { return nil }
func (AppModule) InitGenesis(_ sdk.Context, _ codec.JSONCodec, _ json.RawMessage) {}
func (AppModule) ExportGenesis(_ sdk.Context, _ codec.JSONCodec) json.RawMessage { return json.RawMessage("{}") }
