# Steering A Live External Agent

Read this document when the experiment is driven by a Claude Code or Codex session that runs for hours rather than for one prompt. A session that long stops being something you observe and becomes something you steer, and steering has its own failure modes. Every one below was paid for in a single campaign, most of them more than once.

[briefing.md](briefing.md) owns what goes into the brief and into every message after it. This document owns how the session itself is driven.

## A Turn Is The Unit Of Work

`codex exec resume <session-uuid> "<message>"` runs exactly one turn and exits. Two readings of the process table are therefore both wrong: a live process is not proof the agent is working, and an exited process is not proof it has stopped.

Read the session file instead. `~/.codex/sessions/` holds one file per session, and it grows second by second while a turn runs and stops the moment the turn ends. Its modification time is the signal; poll that.

Both misreadings were made in one campaign and both were expensive. Two hours twenty minutes went to a turn killed while it was still working, and one hour forty-seven to a finished turn left idle because a plan it had stated read as work in progress.

A plan is not execution. A turn that ends by describing what it will do next has not done it, and the next turn is yours to send.

## There Is No Steering Window Inside A Turn

Input to a session that is mid-turn is refused, with `thread-store conflict: thread <uuid> already has an active writer`.

That refusal costs whatever the turn keeps producing meanwhile. The same 2h20m turn spent itself photographing a building from 24 angles whose surfaces were all wrong, which is two hours of evidence that was stale before it arrived.

Keep the next message in a file, and have the retry loop re-read that file on every attempt before it calls `codex exec resume`. Re-reading is the point: edit the file and what eventually arrives changes with it. Two wrong diagnoses were replaced that way before they reached the agent.

Two details decide whether the delivery works at all.

- Name the session UUID explicitly. `--last` resolves to a sub-agent thread and fails with `direct app-server input is not allowed for multi-agent v2 sub-agents`.
- `codex exec resume` accepts no `-C`, so change directory first.

## One Machine, Several Campaigns

Confirm your own session UUID is on a process's command line before killing it, and leave it alone otherwise. A sub-agent runner does not print the session it belongs to, so `codex exec --cd . -c agents.max_threads=32 ...` is all the process table shows and two campaigns on one machine are indistinguishable in it.

An indiscriminate `taskkill` destroys hours of the other campaign's work. It happened more than once here, and the killed fleets left orphan capture runners contending over the same state until the capture stopped updating without saying so.

Kill the main process only. Its children clean up behind it.

## The Agent Will Rebut You, And May Be Right

Tell the agent how you obtained every claim you send it, the same way [Read The Result](SKILL.md#read-the-result) requires it of your own conclusions. An agent that knows a claim came from a frame can challenge the frame; one handed a bare assertion can only comply with it.

The observer was wrong seven times in that campaign. The most expensive one placed a defect that did not exist, an empty roof field and a flat ground-floor wall, at priorities one and two of a multi-agent fan-out. The real defect was in the observer's own 88-camera sweep renderer, which was dropping instanced geometry, and it surfaced only because the authoring agent pushed back:

> The actionable remaining defect is in the external 88-camera sweep renderer's handling of GPU instancing, not the residence geometry.

Settle that kind of rebuttal by measurement rather than by another look at the frames. Counting 39 oriel elements and 57 hub pieces in the compiled artifact withdrew two more claims immediately, and both of those claims would have survived another round of looking at frames.

## Ask For Its List When Yours Is Empty

Running out of findings is not the same as there being none left, so ask the agent for its own before you treat the run as closed.

Told that the observer's list was empty, the agent in that campaign returned three priorities, one of which was its own review camera standing inside a room it was supposed to show. The observer had never considered it. The agent also named the exact evidence that would separate its three hypotheses, and that exchange was the most productive of the campaign.

The closing condition itself belongs to the brief, which names the reference set both lists are checked against. See [Say What Ends The Run](briefing.md#say-what-ends-the-run).

## Prove The Pixels Are New

A checkpoint report is the agent's claim about its output, not a reading of it. One reported `revision 212, gables stand, spire clears the ridge` while the PNG on disk was byte-identical to the file written three hours earlier, which a hash caught and a description never would have.

Compare every sweep against the previous round byte for byte. How many frames changed and which ones changed is the progress report: in round three, 25 of 88 changed and all 25 were the courtyard and the upper storeys, which said plainly that nothing had yet touched the rest.
