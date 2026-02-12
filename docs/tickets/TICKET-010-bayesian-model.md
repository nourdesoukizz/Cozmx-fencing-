# TICKET-010: Bayesian Performance Model

## Status: Superseded by TICKET-016

This ticket has been replaced by TICKET-016 (Bradley-Terry Live Probability Engine).

The conjugate normal-normal Bayesian model has been replaced with a Bradley-Terry touch-level model
that estimates all fencer strengths globally using the MM algorithm (Hunter 2004).

Key improvements:
- Global strength estimation (transitive evidence propagates across all fencers)
- Touch-level modeling (each touch is a Bernoulli trial, not just bout outcomes)
- Full refit after every bout (not just independent per-fencer updates)
- Trajectory tracking (strength history over time for visualization)
- Monte Carlo DE bracket simulation
- Pairwise matchup lookup with head-to-head records

## Metadata
- **Priority**: N/A (superseded)
- **Type**: Feature
- **Module**: Coach Analytics
- **Superseded by**: TICKET-016
