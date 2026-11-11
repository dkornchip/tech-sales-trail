import React from "react";

// One icon from the sprite the build inlines (scripts/build.mjs finds every name="..." and icon:"..." in the source).
export const Icon = ({ name, className = "" }) => (
  <svg className={"icon" + (className ? " " + className : "")} aria-hidden="true" focusable="false"><use href={"#i-" + name} /></svg>
);
