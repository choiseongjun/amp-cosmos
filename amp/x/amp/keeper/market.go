package keeper

import (
    "context"
    "fmt"

    sdk "github.com/cosmos/cosmos-sdk/types"
    sdkmath "cosmossdk.io/math"
    authtypes "github.com/cosmos/cosmos-sdk/x/auth/types"
    "cosmossdk.io/collections"

    "amp/x/amp/types"
)

// ListItem creates a new listing, locks the seller's asset into escrow and returns its ID.
func (k Keeper) ListItem(ctx context.Context, seller sdk.AccAddress, title, description string, asset, price sdk.Coin) (uint64, error) {
    if err := asset.Validate(); err != nil {
        return 0, err
    }
    if err := price.Validate(); err != nil {
        return 0, err
    }

    id, err := k.ListingSeq.Next(ctx)
    if err != nil {
        return 0, err
    }

    // record creation time based on block time
    t := sdk.UnwrapSDKContext(ctx).BlockTime().Unix()

    sellerStr, _ := k.addressCodec.BytesToString(seller)

    // move asset to escrow
    escrow := authtypes.NewModuleAddress(types.EscrowModuleName)
    if err := k.bankKeeper.SendCoins(ctx, seller, escrow, sdk.NewCoins(asset)); err != nil {
        return 0, err
    }

    listing := types.Listing{
        Id:          id,
        Seller:      sellerStr,
        Title:       title,
        Description: description,
        Asset:       asset,
        Price:       price,
        Status:      types.ListingStatus_LISTING_STATUS_ACTIVE,
        Buyer:       "",
        CreatedAt:   t,
    }

    if err := k.Listings.Set(ctx, id, listing); err != nil {
        return 0, err
    }

    // emit typed and legacy events
    sdkCtx := sdk.UnwrapSDKContext(ctx)
    _ = sdkCtx.EventManager().EmitTypedEvent(&types.EventItemListed{
        Id:        id,
        Seller:    sellerStr,
        Asset:     asset,
        Price:     price,
        CreatedAt: t,
    })
    sdkCtx.EventManager().EmitEvent(
        sdk.NewEvent(
            types.EventTypeItemListed,
            sdk.NewAttribute(types.AttributeKeyListingID, fmt.Sprintf("%d", id)),
            sdk.NewAttribute(types.AttributeKeySeller, sellerStr),
            sdk.NewAttribute(types.AttributeKeyAsset, asset.String()),
            sdk.NewAttribute(types.AttributeKeyPrice, price.String()),
        ),
    )
    return id, nil
}

// BuyItem transfers payment (with commission), releases asset to buyer, and marks the listing as sold.
func (k Keeper) BuyItem(ctx context.Context, buyer sdk.AccAddress, id uint64) error {
    listing, err := k.Listings.Get(ctx, id)
    if err != nil {
        return err
    }
    if listing.Status != types.ListingStatus_LISTING_STATUS_ACTIVE {
        return types.ErrListingNotActive
    }

    // prevent self-purchase
    buyerStr, _ := k.addressCodec.BytesToString(buyer)
    if buyerStr == listing.Seller {
        return types.ErrSelfPurchase
    }

    // transfer price from buyer to seller and commission
    price := listing.Price
    sellerAddrBz, err := k.addressCodec.StringToBytes(listing.Seller)
    if err != nil {
        return err
    }
    seller := sdk.AccAddress(sellerAddrBz)

    // compute commission
    params, err := k.Params.Get(ctx)
    if err != nil {
        return err
    }
    rate := params.CommissionRate
    priceDec := sdkmath.LegacyNewDecFromInt(price.Amount)
    feeAmt := priceDec.Mul(rate).TruncateInt()
    sellerAmt := price.Amount.Sub(feeAmt)
    if sellerAmt.IsNegative() {
        sellerAmt = sdkmath.ZeroInt()
    }

    feeCollector := authtypes.NewModuleAddress(authtypes.FeeCollectorName)

    if feeAmt.IsPositive() {
        if err := k.bankKeeper.SendCoins(ctx, buyer, feeCollector, sdk.NewCoins(sdk.NewCoin(price.Denom, feeAmt))); err != nil {
            return err
        }
    }
    if sellerAmt.IsPositive() {
        if err := k.bankKeeper.SendCoins(ctx, buyer, seller, sdk.NewCoins(sdk.NewCoin(price.Denom, sellerAmt))); err != nil {
            return err
        }
    }

    // release asset from escrow to buyer
    escrow := authtypes.NewModuleAddress(types.EscrowModuleName)
    if err := k.bankKeeper.SendCoins(ctx, escrow, buyer, sdk.NewCoins(listing.Asset)); err != nil {
        return err
    }

    // mark as sold
    listing.Status = types.ListingStatus_LISTING_STATUS_SOLD
    listing.Buyer = buyerStr
    if err := k.Listings.Set(ctx, id, listing); err != nil {
        return err
    }

    // emit events
    sdkCtx := sdk.UnwrapSDKContext(ctx)
    feeCoin := sdk.NewCoin(price.Denom, feeAmt)
    sellerCoin := sdk.NewCoin(price.Denom, sellerAmt)
    _ = sdkCtx.EventManager().EmitTypedEvent(&types.EventItemBought{
        Id:           id,
        Seller:       listing.Seller,
        Buyer:        buyerStr,
        Asset:        listing.Asset,
        Price:        price,
        Fee:          feeCoin,
        SellerAmount: sellerCoin,
    })
    sdkCtx.EventManager().EmitEvent(
        sdk.NewEvent(
            types.EventTypeItemBought,
            sdk.NewAttribute(types.AttributeKeyListingID, fmt.Sprintf("%d", id)),
            sdk.NewAttribute(types.AttributeKeySeller, listing.Seller),
            sdk.NewAttribute(types.AttributeKeyBuyer, buyerStr),
            sdk.NewAttribute(types.AttributeKeyAsset, listing.Asset.String()),
            sdk.NewAttribute(types.AttributeKeyPrice, price.String()),
            sdk.NewAttribute(types.AttributeKeyFee, feeCoin.String()),
        ),
    )
    return nil
}

// DelistItem cancels an active listing, only by seller, and returns asset to seller.
func (k Keeper) DelistItem(ctx context.Context, seller sdk.AccAddress, id uint64) error {
    listing, err := k.Listings.Get(ctx, id)
    if err != nil {
        return err
    }
    if listing.Status != types.ListingStatus_LISTING_STATUS_ACTIVE {
        return types.ErrListingNotActive
    }

    sellerStr, _ := k.addressCodec.BytesToString(seller)
    if sellerStr != listing.Seller {
        return types.ErrUnauthorized
    }

    // return asset from escrow to seller
    escrow := authtypes.NewModuleAddress(types.EscrowModuleName)
    if err := k.bankKeeper.SendCoins(ctx, escrow, seller, sdk.NewCoins(listing.Asset)); err != nil {
        return err
    }

    listing.Status = types.ListingStatus_LISTING_STATUS_CANCELLED
    if err := k.Listings.Set(ctx, id, listing); err != nil {
        return err
    }

    sdkCtx := sdk.UnwrapSDKContext(ctx)
    _ = sdkCtx.EventManager().EmitTypedEvent(&types.EventItemDelisted{
        Id:     id,
        Seller: sellerStr,
    })
    sdkCtx.EventManager().EmitEvent(
        sdk.NewEvent(
            types.EventTypeItemDelisted,
            sdk.NewAttribute(types.AttributeKeyListingID, fmt.Sprintf("%d", id)),
            sdk.NewAttribute(types.AttributeKeySeller, sellerStr),
        ),
    )
    return nil
}

// GetListing returns a listing by ID and a boolean whether it exists.
func (k Keeper) GetListing(ctx context.Context, id uint64) (types.Listing, bool) {
    listing, err := k.Listings.Get(ctx, id)
    if err != nil {
        return types.Listing{}, false
    }
    return listing, true
}

// IterateListings provides a simple iterator over listings; apply handler to each until it returns true.
func (k Keeper) IterateListings(ctx context.Context, handler func(types.Listing) (stop bool)) error {
    rng := collections.Range[uint64]{}
    it, err := k.Listings.Iterate(ctx, &rng)
    if err != nil {
        return err
    }
    defer it.Close()
    for ; it.Valid(); it.Next() {
        v, err := it.Value()
        if err != nil {
            return err
        }
        if handler(v) {
            break
        }
    }
    return nil
}
