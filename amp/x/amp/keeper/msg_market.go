package keeper

import (
    "context"

    sdk "github.com/cosmos/cosmos-sdk/types"

    "amp/x/amp/types"
)

func (m msgServer) ListItem(ctx context.Context, req *types.MsgListItem) (*types.MsgListItemResponse, error) {
    // validate signer address
    sellerBz, err := m.addressCodec.StringToBytes(req.Seller)
    if err != nil {
        return nil, err
    }
    seller := sdk.AccAddress(sellerBz)

    id, err := m.Keeper.ListItem(ctx, seller, req.Title, req.Description, req.Asset, req.Price)
    if err != nil {
        return nil, err
    }

    return &types.MsgListItemResponse{Id: id}, nil
}

func (m msgServer) BuyItem(ctx context.Context, req *types.MsgBuyItem) (*types.MsgBuyItemResponse, error) {
    buyerBz, err := m.addressCodec.StringToBytes(req.Buyer)
    if err != nil {
        return nil, err
    }
    buyer := sdk.AccAddress(buyerBz)

    if err := m.Keeper.BuyItem(ctx, buyer, req.ListingId); err != nil {
        return nil, err
    }
    return &types.MsgBuyItemResponse{}, nil
}

func (m msgServer) DelistItem(ctx context.Context, req *types.MsgDelistItem) (*types.MsgDelistItemResponse, error) {
    sellerBz, err := m.addressCodec.StringToBytes(req.Seller)
    if err != nil {
        return nil, err
    }
    seller := sdk.AccAddress(sellerBz)

    if err := m.Keeper.DelistItem(ctx, seller, req.ListingId); err != nil {
        return nil, err
    }
    return &types.MsgDelistItemResponse{}, nil
}
