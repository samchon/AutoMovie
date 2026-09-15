import type { IAutoMoviePreviewNavigation } from "./sourcePreview";

/**
 * Mount shared navigation without owning a production's camera or identities.
 * The returned disposer removes the panel and all of its event listeners.
 */
export const mountPreviewNavigation = (
  navigation: IAutoMoviePreviewNavigation,
): (() => void) => {
  const identities = new Set<string>();
  const entries = navigation.items.map((item) => {
    if (item.id.length === 0 || identities.has(item.id))
      throw new Error("Preview navigation requires unique, nonempty item IDs.");
    identities.add(item.id);
    return {
      ...item,
      search: [item.id, item.label, item.group ?? "", ...(item.keywords ?? [])]
        .join(" ")
        .normalize("NFKC")
        .toLowerCase(),
    };
  });
  const input = new AbortController();
  const panel = document.createElement("section");
  panel.id = "preview-navigation";
  panel.setAttribute("aria-label", "Scene navigation");
  const heading = document.createElement("div");
  heading.className = "preview-navigation-heading";
  const title = document.createElement("strong");
  title.textContent = "Scene navigation";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Collapse";
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-controls", "preview-navigation-content");
  heading.append(title, toggle);
  const content = document.createElement("div");
  content.id = "preview-navigation-content";
  const searchLabel = document.createElement("label");
  searchLabel.textContent = "Search rooms, objects, or views";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Name, group, or keyword";
  search.autocomplete = "off";
  searchLabel.append(search);
  const selectLabel = document.createElement("label");
  selectLabel.textContent = "View";
  const select = document.createElement("select");
  selectLabel.append(select);
  const go = document.createElement("button");
  go.type = "button";
  go.textContent = "Go to view";
  const count = document.createElement("div");
  count.className = "preview-navigation-count";
  count.setAttribute("role", "status");
  content.append(searchLabel, selectLabel, go, count);
  panel.append(heading, content);
  let selected = "";
  const refresh = (): void => {
    const terms = search.value
      .normalize("NFKC")
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const matches = entries.filter((item) =>
      terms.every((term) => item.search.includes(term)),
    );
    const placeholder = new Option(
      matches.length === 0 ? "No matching views" : "Choose a view",
      "",
    );
    placeholder.disabled = true;
    select.replaceChildren(placeholder);
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const item of matches) {
      const option = new Option(item.label, item.id);
      if (item.group === undefined || item.group.length === 0)
        select.append(option);
      else {
        let group = groups.get(item.group);
        if (group === undefined) {
          group = document.createElement("optgroup");
          group.label = item.group;
          groups.set(item.group, group);
          select.append(group);
        }
        group.append(option);
      }
    }
    select.value = matches.some((item) => item.id === selected) ? selected : "";
    select.disabled = matches.length === 0;
    go.disabled = select.value.length === 0;
    count.textContent = `${matches.length} of ${entries.length} views`;
  };
  search.addEventListener("input", refresh, { signal: input.signal });
  select.addEventListener(
    "change",
    () => {
      selected = select.value;
      go.disabled = false;
      navigation.apply(selected);
    },
    { signal: input.signal },
  );
  go.addEventListener("click", () => navigation.apply(select.value), {
    signal: input.signal,
  });
  toggle.addEventListener(
    "click",
    () => {
      content.hidden = !content.hidden;
      toggle.textContent = content.hidden ? "Expand" : "Collapse";
      toggle.setAttribute("aria-expanded", String(!content.hidden));
    },
    { signal: input.signal },
  );
  refresh();
  document.body.append(panel);
  return () => {
    input.abort();
    panel.remove();
  };
};
