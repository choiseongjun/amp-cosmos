package keeper

import (
    "context"
    "errors"

    "cosmossdk.io/collections"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    "amp/x/amp/types"
)

func (q queryServer) Listing(ctx context.Context, req *types.QueryListingRequest) (*types.QueryListingResponse, error) {
    if req == nil {
        return nil, status.Error(codes.InvalidArgument, "invalid request")
    }
    listing, err := q.k.Listings.Get(ctx, req.Id)
    if err != nil {
        if errors.Is(err, collections.ErrNotFound) {
            return nil, status.Error(codes.NotFound, "listing not found")
        }
        return nil, status.Error(codes.Internal, "internal error")
    }
    return &types.QueryListingResponse{Listing: &listing}, nil
}

func (q queryServer) Listings(ctx context.Context, req *types.QueryListingsRequest) (*types.QueryListingsResponse, error) {
    if req == nil {
        return nil, status.Error(codes.InvalidArgument, "invalid request")
    }
    var listings []*types.Listing
    rng := collections.Range[uint64]{}
    it, err := q.k.Listings.Iterate(ctx, &rng)
    if err != nil {
        return nil, status.Error(codes.Internal, "internal error")
    }
    defer it.Close()
    for ; it.Valid(); it.Next() {
        v, err := it.Value()
        if err != nil {
            return nil, status.Error(codes.Internal, "internal error")
        }
        vv := v
        listings = append(listings, &vv)
    }
    // Note: simple listing without pagination; SDK pagination can be wired later
    return &types.QueryListingsResponse{Listings: listings}, nil
}
