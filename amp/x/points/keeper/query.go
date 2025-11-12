package keeper

import (
    "context"

    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    "amp/x/points/types"
)

type queryServer struct { k Keeper }

func NewQueryServerImpl(k Keeper) types.QueryServer { return &queryServer{k: k} }

func (q *queryServer) Score(ctx context.Context, req *types.QueryScoreRequest) (*types.QueryScoreResponse, error) {
    if req == nil || req.Address == "" {
        return nil, status.Error(codes.InvalidArgument, "address required")
    }
    score, err := q.k.Scores.Get(ctx, req.Address)
    if err != nil {
        // not found → 0
        return &types.QueryScoreResponse{Score: 0}, nil
    }
    return &types.QueryScoreResponse{Score: score}, nil
}

