package points

import (
    autocliv1 "cosmossdk.io/api/cosmos/autocli/v1"
    "amp/x/points/types"
)

func (am AppModule) AutoCLIOptions() *autocliv1.ModuleOptions {
    return &autocliv1.ModuleOptions{
        Query: &autocliv1.ServiceCommandDescriptor{
            Service: types.Query_serviceDesc.ServiceName,
            RpcCommandOptions: []*autocliv1.RpcCommandOptions{
                { RpcMethod: "Score", Use: "score [address]", Short: "Query score for address" },
            },
        },
        Tx: &autocliv1.ServiceCommandDescriptor{
            Service: types.Msg_serviceDesc.ServiceName,
            RpcCommandOptions: []*autocliv1.RpcCommandOptions{
                { RpcMethod: "RecordActivity", Use: "record-activity [address] [action] [weight]", Short: "Record activity and increase points" },
            },
        },
    }
}

