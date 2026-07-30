const parameters = new URLSearchParams(window.location.search);
if (parameters.has("asset")) await import("./asset");
else if (parameters.has("film")) await import("./film");
else await import("./shot");
