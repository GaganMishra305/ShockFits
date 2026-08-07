#include "shockfits/search.hpp"

#include <algorithm>
#include <cstdio>
#include <iostream>
#include <string>
#include <vector>

#include "shockfits/eval.hpp"
#include "shockfits/movegen.hpp"

namespace shockfits {

namespace {

constexpr int kInf = kValueInfinite;
constexpr int kPieceVal[6] = {100, 320, 330, 500, 900, 20000};

bool is_capture(const Board& b, Move m) {
    return !b.piece_on(m.to()).is_none() || m.type() == MT_EN_PASSANT;
}

// Adjust mate scores when reading/writing the TT so "mate in N" stays relative
// to the current node rather than the root.
int score_to_tt(int score, int ply) {
    if (score >= kValueMateInMaxPly) return score + ply;
    if (score <= -kValueMateInMaxPly) return score - ply;
    return score;
}
int score_from_tt(int score, int ply) {
    if (score >= kValueMateInMaxPly) return score - ply;
    if (score <= -kValueMateInMaxPly) return score + ply;
    return score;
}

}  // namespace

std::string Searcher::pv_string(Board& b, int max_len) {
    std::string pv;
    std::vector<Move> played;
    for (int i = 0; i < max_len; ++i) {
        const TTEntry* e = tt_.probe(b.key());
        if (!e || e->move == kNullMove) break;

        // Verify the TT move is legal in this position (guards against
        // key collisions producing garbage moves).
        MoveList legal;
        generate_legal(b, legal);
        bool ok = false;
        for (Move m : legal)
            if (m == e->move) { ok = true; break; }
        if (!ok) break;

        if (!pv.empty()) pv += ' ';
        pv += e->move.to_uci();
        b.make_move(e->move);
        played.push_back(e->move);
    }
    for (auto it = played.rbegin(); it != played.rend(); ++it)
        b.unmake_move(*it);
    return pv;
}

bool Searcher::time_up() {    if (max_nodes_ && nodes_ >= max_nodes_) return true;
    if (movetime_ms_ <= 0) return false;
    auto now = std::chrono::steady_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now - start_)
                  .count();
    return ms >= movetime_ms_;
}

int Searcher::quiescence(Board& b, int alpha, int beta, int ply) {
    if ((++nodes_ & 2047) == 0 && time_up()) stop_ = true;
    if (stop_) return 0;

    int stand_pat = evaluate(b);
    if (stand_pat >= beta) return beta;
    if (stand_pat > alpha) alpha = stand_pat;
    if (ply >= kMaxPly - 1) return stand_pat;

    MoveList moves;
    generate_legal(b, moves);

    // Only search "loud" moves: captures and promotions.
    struct Scored { Move m; int s; };
    Scored scored[256];
    int n = 0;
    for (Move m : moves) {
        bool cap = is_capture(b, m);
        bool promo = m.type() == MT_PROMOTION;
        if (!cap && !promo) continue;
        int s = 0;
        if (cap) {
            PieceType victim = (m.type() == MT_EN_PASSANT)
                                   ? PAWN
                                   : b.piece_on(m.to()).type;
            PieceType attacker = b.piece_on(m.from()).type;
            s = kPieceVal[victim] * 16 - kPieceVal[attacker];
        }
        if (promo) s += kPieceVal[m.promotion()];
        scored[n++] = {m, s};
    }

    for (int i = 0; i < n; ++i) {
        int best = i;
        for (int j = i + 1; j < n; ++j)
            if (scored[j].s > scored[best].s) best = j;
        std::swap(scored[i], scored[best]);

        b.make_move(scored[i].m);
        int score = -quiescence(b, -beta, -alpha, ply + 1);
        b.unmake_move(scored[i].m);

        if (stop_) return 0;
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

int Searcher::negamax(Board& b, int depth, int alpha, int beta, int ply) {
    if ((++nodes_ & 2047) == 0 && time_up()) stop_ = true;
    if (stop_) return 0;

    bool in_check = b.in_check();
    if (in_check) ++depth;  // check extension

    if (depth <= 0) return quiescence(b, alpha, beta, ply);

    std::uint64_t key = b.key();
    const TTEntry* tte = tt_.probe(key);
    Move tt_move = kNullMove;
    if (tte) {
        tt_move = tte->move;
        if (ply > 0 && tte->depth >= depth) {
            int s = score_from_tt(tte->score, ply);
            if (tte->bound == BOUND_EXACT) return s;
            if (tte->bound == BOUND_LOWER && s >= beta) return s;
            if (tte->bound == BOUND_UPPER && s <= alpha) return s;
        }
    }

    MoveList moves;
    generate_legal(b, moves);
    if (moves.size() == 0) {
        return in_check ? (-kValueMate + ply) : 0;  // checkmate / stalemate
    }

    Color us = b.side_to_move();

    // Score moves for ordering.
    struct Scored { Move m; int s; };
    Scored scored[256];
    int n = 0;
    for (Move m : moves) {
        int s;
        if (m == tt_move) {
            s = 2'000'000;
        } else if (is_capture(b, m)) {
            PieceType victim = (m.type() == MT_EN_PASSANT)
                                   ? PAWN
                                   : b.piece_on(m.to()).type;
            PieceType attacker = b.piece_on(m.from()).type;
            s = 1'000'000 + kPieceVal[victim] * 16 - kPieceVal[attacker];
        } else if (m.type() == MT_PROMOTION) {
            s = 900'000 + kPieceVal[m.promotion()];
        } else if (m == killers_[ply][0]) {
            s = 800'000;
        } else if (m == killers_[ply][1]) {
            s = 700'000;
        } else {
            s = history_[us][m.from()][m.to()];
        }
        scored[n++] = {m, s};
    }

    int best = -kInf;
    Move best_move = kNullMove;
    Bound flag = BOUND_UPPER;

    for (int i = 0; i < n; ++i) {
        int pick = i;
        for (int j = i + 1; j < n; ++j)
            if (scored[j].s > scored[pick].s) pick = j;
        std::swap(scored[i], scored[pick]);
        Move m = scored[i].m;

        b.make_move(m);
        int score = -negamax(b, depth - 1, -beta, -alpha, ply + 1);
        b.unmake_move(m);

        if (stop_) return 0;

        if (score > best) {
            best = score;
            best_move = m;
            if (ply == 0) root_best_ = m;
            if (score > alpha) {
                alpha = score;
                flag = BOUND_EXACT;
                if (alpha >= beta) {
                    flag = BOUND_LOWER;
                    if (!is_capture(b, m) && m.type() != MT_PROMOTION) {
                        if (m != killers_[ply][0]) {
                            killers_[ply][1] = killers_[ply][0];
                            killers_[ply][0] = m;
                        }
                        history_[us][m.from()][m.to()] += depth * depth;
                    }
                    break;
                }
            }
        }
    }

    tt_.store(key, score_to_tt(best, ply), flag, depth, best_move);
    return best;
}

SearchResult Searcher::search(Board& b, const SearchLimits& limits,
                              bool verbose) {
    nodes_ = 0;
    stop_ = false;
    start_ = std::chrono::steady_clock::now();
    movetime_ms_ = limits.movetime_ms;
    max_nodes_ = limits.max_nodes;
    root_best_ = kNullMove;
    for (auto& k : killers_) { k[0] = kNullMove; k[1] = kNullMove; }

    // Guarantee a legal fallback move.
    MoveList root_moves;
    generate_legal(b, root_moves);
    SearchResult result;
    if (root_moves.size() == 0) return result;
    result.best = root_moves[0];

    for (int depth = 1; depth <= limits.max_depth; ++depth) {
        int score = negamax(b, depth, -kInf, kInf, 0);
        if (stop_) break;  // discard incomplete iteration

        result.best = root_best_;
        result.score = score;
        result.depth = depth;

        if (verbose) {
            auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                          std::chrono::steady_clock::now() - start_)
                          .count();
            std::uint64_t nps =
                ms > 0 ? (nodes_ * 1000ULL / (std::uint64_t)ms) : nodes_;
            std::string pv = pv_string(b, depth);
            if (pv.empty()) pv = result.best.to_uci();

            // Report mate scores as "mate N" (moves), else centipawns.
            char score_buf[32];
            if (score >= kValueMateInMaxPly) {
                std::snprintf(score_buf, sizeof(score_buf), "mate %d",
                              (kValueMate - score + 1) / 2);
            } else if (score <= -kValueMateInMaxPly) {
                std::snprintf(score_buf, sizeof(score_buf), "mate %d",
                              -(kValueMate + score + 1) / 2);
            } else {
                std::snprintf(score_buf, sizeof(score_buf), "cp %d", score);
            }

            std::cout << "info depth " << depth << " score " << score_buf
                      << " nodes " << nodes_ << " nps " << nps << " time "
                      << ms << " pv " << pv << "\n";
            std::cout.flush();
        }

        // Stop early on a proven mate.
        if (score >= kValueMateInMaxPly || score <= -kValueMateInMaxPly) break;
    }

    result.nodes = nodes_;
    return result;
}

}  // namespace shockfits
