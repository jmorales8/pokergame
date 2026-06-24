"use client";

import { useState } from "react";

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

type Card = {
  rank: Rank;
  suit: Suit;
  value: number;
};

const suits: Suit[] = ["♠", "♥", "♦", "♣"];

const ranks: { rank: Rank; value: number }[] = [
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 11 },
  { rank: "Q", value: 12 },
  { rank: "K", value: 13 },
  { rank: "A", value: 14 },
];

function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        rank: rank.rank,
        suit,
        value: rank.value,
      });
    }
  }

  return deck;
}

function shuffleDeck(deck: Card[]) {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled;
}

function getHandScore(hand: Card[]) {
  const values = hand.map((card) => card.value).sort((a, b) => b - a);
  const suits = hand.map((card) => card.suit);

  const counts: Record<number, number> = {};

  for (const value of values) {
    counts[value] = (counts[value] || 0) + 1;
  }

  const countValues = Object.values(counts).sort((a, b) => b - a);

  const isFlush = suits.every((suit) => suit === suits[0]);

  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  const isStraight =
    uniqueValues.length === 5 && uniqueValues[0] - uniqueValues[4] === 4;

  if (isStraight && isFlush) return { score: 8, name: "Straight Flush" };
  if (countValues[0] === 4) return { score: 7, name: "Four of a Kind" };
  if (countValues[0] === 3 && countValues[1] === 2) return { score: 6, name: "Full House" };
  if (isFlush) return { score: 5, name: "Flush" };
  if (isStraight) return { score: 4, name: "Straight" };
  if (countValues[0] === 3) return { score: 3, name: "Three of a Kind" };
  if (countValues[0] === 2 && countValues[1] === 2) return { score: 2, name: "Two Pair" };
  if (countValues[0] === 2) return { score: 1, name: "One Pair" };

  return { score: 0, name: "High Card" };
}

function CardView({ card }: { card: Card }) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  return (
    <div
      className={`flex h-24 w-16 flex-col items-center justify-center rounded-lg border bg-white text-xl font-bold shadow ${
        isRed ? "text-red-500" : "text-black"
      }`}
    >
      <div>{card.rank}</div>
      <div>{card.suit}</div>
    </div>
  );
}

export default function PokerPage() {
  const [playerOneHand, setPlayerOneHand] = useState<Card[]>([]);
  const [playerTwoHand, setPlayerTwoHand] = useState<Card[]>([]);
  const [winner, setWinner] = useState("");

  function dealCards() {
    const deck = shuffleDeck(createDeck());

    const playerOne = deck.slice(0, 5);
    const playerTwo = deck.slice(5, 10);

    const playerOneScore = getHandScore(playerOne);
    const playerTwoScore = getHandScore(playerTwo);

    setPlayerOneHand(playerOne);
    setPlayerTwoHand(playerTwo);

    if (playerOneScore.score > playerTwoScore.score) {
      setWinner(`Player 1 wins with ${playerOneScore.name}`);
    } else if (playerTwoScore.score > playerOneScore.score) {
      setWinner(`Player 2 wins with ${playerTwoScore.name}`);
    } else {
      setWinner(`Tie! Both players have ${playerOneScore.name}`);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-green-800 p-8 text-white">
      <h1 className="text-4xl font-bold">Two Player Poker</h1>

      <button
        onClick={dealCards}
        className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300"
      >
        Deal Cards
      </button>

      {winner && <h2 className="text-2xl font-bold">{winner}</h2>}

      <section className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold">Player 1</h2>
        <div className="flex gap-3">
          {playerOneHand.map((card, index) => (
            <CardView key={index} card={card} />
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold">Player 2</h2>
        <div className="flex gap-3">
          {playerTwoHand.map((card, index) => (
            <CardView key={index} card={card} />
          ))}
        </div>
      </section>
    </main>
  );
}
