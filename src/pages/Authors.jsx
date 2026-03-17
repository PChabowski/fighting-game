// src/pages/Authors.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import useGameStore from "../store/useGameStore";
import "../style.css";
import styles from "../styles/mobile.module.css";

const contributors = [
  // Fill with real contributors/asset authors later
  { name: "Free Asset Author 1", url: "https://example.com" },
  { name: "Free Asset Author 2", url: "https://example.com" },
];

export default function Authors() {
  const navigate = useNavigate();
  const setView = useGameStore((state) => state.setView);

  function goBack() {
    // return to game menu view and navigate home
    setView("MENU");
    navigate("/");
  }

  return (
    <div className={`conteiner ${styles.scrollable}`}>
      <button
        className="button"
        onClick={goBack}
        style={{ position: "absolute", top: 12, left: 12 }}
        aria-label="Go back"
      >
        ← Back
      </button>
      <article style={{ textAlign: "center" }}>
        <h1>Game Authors</h1>
        <h2 style={{ margin: "32px 0" }}>Author</h2>
        <p>
          Paweł Chabowski —{" "}
          <a href="https://archweb.online" target="_blank" rel="noreferrer">
            https://archweb.online
          </a>
        </p>

        <h2 style={{ margin: "32px 0" }}>
          Thank you to all free asset creators whose work made this game
          possible.
        </h2>
        <h3 style={{ margin: "24px 0" }}>Music & sound effects</h3>
        <p style={{ whiteSpace: "nowrap" }}>
          Iwan Gabovitch — <a href="mailto:qubodup@gmail.com">Email</a>
        </p>
        <p style={{ whiteSpace: "nowrap" }}>
          Juhani Junkala —{" "}
          <a href="https://juhanijunkala.com/" target="_blank" rel="noreferrer">
            Website
          </a>
        </p>
        <h3 style={{ margin: "32px 0" }}>Game Graphics & Art Credits</h3>
        <p style={{ whiteSpace: "nowrap" }}>
          Luiz Melo —{" "}
          <a href="https://x.com/LuizGdeMelo" target="_blank" rel="noreferrer">
            Twitter
          </a>
        </p>
        <p style={{ whiteSpace: "nowrap" }}>
          Artem Brullov —{" "}
          <a href="https://x.com/brullov_art" target="_blank" rel="noreferrer">
            Twitter
          </a>
        </p>
        {/* Lista contributorów usunięta */}
      </article>
    </div>
  );
}
