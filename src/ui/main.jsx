import React from "react";
import ReactDOM from "react-dom/client";
import { CRASH } from "../copy/ui.js";
import { AUTOSAVE_KEY, SET_ASIDE_KEY } from "../game/constants.js";
import { Game } from "./Game.jsx";

// The last line of defence: if the game cannot draw itself at all, say so and offer a way out instead of a blank
// page. (A stored run that cannot be opened no longer gets this far: it is caught when it is read, and the game
// offers what can be done about it. This is for an error nobody foresaw.) "New run" sets the autosave aside under another key, so nothing is destroyed, and starts
// a fresh game in place: it does not reload the page and it does not read storage again, so a damaged manual save
// cannot bring the same page straight back. (That save is still there for Load, which can fail the same way and
// lands here again.)
class Crash extends React.Component {
  constructor(props) { super(props); this.state = { failed: false, attempt: 0 }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { try { console.error(error); } catch {} }
  render() {
    if (!this.state.failed) return this.props.children(this.state.attempt);
    const again = () => {
      // whatever was under the autosave key is kept aside before the new run takes its place
      try { const raw = localStorage.getItem(AUTOSAVE_KEY); if (raw) localStorage.setItem(SET_ASIDE_KEY, raw); } catch {}
      this.setState(st => ({ failed: false, attempt: st.attempt + 1 }));
    };
    return (
      <div className="crash" role="alert">
        <h1>{CRASH.title}</h1>
        <p>{CRASH.body}</p>
        <button type="button" className="btn primary" data-ui="crash-new" onClick={again}>{CRASH.newRun}</button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<Crash>{attempt => <Game key={attempt} fresh={attempt > 0} />}</Crash>);
