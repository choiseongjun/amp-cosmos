package keeper

import (
    "context"

    sdk "github.com/cosmos/cosmos-sdk/types"

    "amp/x/points/types"
)

type msgServer struct { k Keeper }

func NewMsgServerImpl(k Keeper) types.MsgServer { return &msgServer{k: k} }

func (m *msgServer) RecordActivity(ctx context.Context, req *types.MsgRecordActivity) (*types.MsgRecordActivityResponse, error) {
    if req == nil {
        return nil, sdkerrorsWrap("invalid request")
    }
    sdkCtx := sdk.UnwrapSDKContext(ctx)
    // validate addresses
    if _, err := m.k.addressCodec.StringToBytes(req.Signer); err != nil { return nil, err }
    if _, err := m.k.addressCodec.StringToBytes(req.Address); err != nil { return nil, err }

    // load score, add weight
    cur, err := m.k.Scores.Get(ctx, req.Address)
    if err != nil { cur = 0 }
    next := cur + req.Weight
    if err := m.k.Scores.Set(ctx, req.Address, next); err != nil { return nil, err }

    // emit event (optional)
    _ = sdkCtx.EventManager().EmitEvent(
        sdk.NewEvent(
            "points_recorded",
            sdk.NewAttribute("address", req.Address),
            sdk.NewAttribute("action", req.Action),
            sdk.NewAttribute("delta", sdk.MustNewDecFromStr(sdk.NewInt(req.Weight).String()).String()),
            sdk.NewAttribute("new_score", sdk.MustNewDecFromStr(sdk.NewInt(next).String()).String()),
        ),
    )

    return &types.MsgRecordActivityResponse{NewScore: next}, nil
}

// small shim to avoid importing errors in this snippet
func sdkerrorsWrap(msg string) error { return &simpleError{msg: msg} }
type simpleError struct{ msg string }
func (e *simpleError) Error() string { return e.msg }

