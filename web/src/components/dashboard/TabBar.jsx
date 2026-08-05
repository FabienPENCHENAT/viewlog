import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { MAX_LABEL } from "../../lib/tab-label.js";
import { useI18n } from "../../i18n/index.jsx";

// Barre des logs ouverts.
//
// Trois partis pris, tous au service de la fluidité :
//  - le nom du fichier n'entre jamais ici (voir lib/tab-label.js) ;
//  - un seul élément glisse et se redimensionne sous l'onglet actif ;
//  - l'entrée est à GAUCHE, la sortie à droite : la barre se lit de gauche à
//    droite comme la durée de vie d'un log.

// Teintes à luminosité constante. L'indice est ATTRIBUÉ au fichier à l'import et
// persisté (voir freeHue dans lib/api.js) : un onglet déplacé garde sa couleur,
// et deux onglets ouverts n'ont jamais la même.
function hueVar(tab) {
  return `var(--tab-hue-${tab?.hue || 0})`;
}

export default function TabBar({
  tabs,
  activeId,
  max,
  onSelect,
  onClose,
  onRename,
  onReorder,
  onAdd,
}) {
  const { t } = useI18n();
  const barRef = useRef(null);
  const trackRef = useRef(null); // piste défilante : ne contient que les onglets
  const [pill, setPill] = useState(null);
  const [renaming, setRenaming] = useState(null); // id en cours de renommage
  const [confirming, setConfirming] = useState(null); // id dont on confirme la suppression
  const [dragId, setDragId] = useState(null);

  // Le focus part sur « Annuler » : sur une action définitive, la touche Entrée
  // réflexe doit être celle qui ne détruit rien.
  const cancelRef = useRef(null);
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  // Délai de grâce avant que « Supprimer » accepte un clic. L'onglet s'élargit
  // pour afficher la question, et « Supprimer » se retrouve alors juste sous le
  // point où l'on vient de cliquer la croix : sans ce délai, un double-clic sur
  // la croix supprimerait le log sans jamais montrer la question.
  const ARM_DELAY = 400;
  const armedAt = useRef(0);

  function askConfirm(id) {
    setRenaming(null);
    setConfirming(id);
    armedAt.current = Date.now();
  }

  function confirmDelete(id) {
    if (Date.now() - armedAt.current < ARM_DELAY) return;
    setConfirming(null);
    onClose(id);
  }

  const activeHue = hueVar(tabs.find((tab) => tab.id === activeId));

  const activeEl = () => trackRef.current?.querySelector('[role="tab"][aria-selected="true"]');

  // Le pill se positionne sur l'onglet actif après rendu : il faut les largeurs
  // réelles, donc une mesure en layout effect.
  const placePill = () => {
    const el = activeEl();
    if (!el) {
      setPill(null);
      return;
    }
    setPill({ left: el.offsetLeft, width: el.offsetWidth, hue: activeHue });
  };

  useLayoutEffect(() => {
    placePill();
    // `renaming` et `confirming` élargissent l'onglet : sans eux ici, le pill
    // garde son ancienne largeur et vient trancher le texte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeHue, tabs, renaming, confirming]);

  // L'onglet actif peut être hors du cadre (navigation au clavier, ou onglet
  // ramené par un réordonnancement) : l'y ramener, sinon on active un onglet
  // qu'on ne voit pas.
  useEffect(() => {
    activeEl()?.scrollIntoView({ block: "nearest", inline: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Dégradés de bord : indispensables ici, car le premier onglet à sortir du
  // cadre est le dernier de la liste, donc celui que le prochain import
  // remplacera. Le cacher sans le dire serait un piège.
  const [more, setMore] = useState("");

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const read = () => {
      const slack = track.scrollWidth - track.clientWidth;
      if (slack <= 1) return setMore("");
      const flags = [];
      if (track.scrollLeft > 1) flags.push("left");
      if (track.scrollLeft < slack - 1) flags.push("right");
      setMore(flags.join(" "));
    };

    read();
    track.addEventListener("scroll", read, { passive: true });

    const ro = new ResizeObserver(read);
    ro.observe(track);

    const onResize = () => {
      read();
      placePill();
    };
    window.addEventListener("resize", onResize);

    return () => {
      track.removeEventListener("scroll", read);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeHue]);

  function move(from, to) {
    if (to < 0 || to >= tabs.length || from === to) return;
    const next = tabs.map((tab) => tab.id);
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next);
  }

  // Toute navigation abandonne une confirmation en cours : une question laissée
  // ouverte sur un autre onglet n'aurait plus de contexte.
  function select(id) {
    setConfirming(null);
    onSelect(id);
  }

  function onKeyDown(e, index) {
    if (e.key === "Escape" && confirming) {
      e.preventDefault();
      setConfirming(null);
      trackRef.current?.querySelectorAll('[role="tab"]')[index]?.focus();
      return;
    }

    // Alt + flèches : déplacer l'onglet. Équivalent clavier du glisser-déposer,
    // donc le même geste protecteur (vers la gauche = à l'abri de la rotation).
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      move(index, e.key === "ArrowLeft" ? index - 1 : index + 1);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -1 : 1;
      const next = (index + step + tabs.length) % tabs.length;
      select(tabs[next].id);
      trackRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
    } else if (e.key === "F2") {
      e.preventDefault();
      setRenaming(tabs[index].id);
    }
  }

  /* --- Glisser-déposer -----------------------------------------------------
     Pointer events plutôt que le drag-and-drop HTML5 : ce dernier impose une
     image fantôme non stylable et n'anime rien. */

  const drag = useRef(null);

  function onPointerDown(e, index) {
    if (e.button !== 0 || renaming || confirming) return;
    const el = e.currentTarget;

    const rects = Array.from(trackRef.current.querySelectorAll('[role="tab"]')).map((n) => ({
      el: n,
      left: n.offsetLeft,
      width: n.offsetWidth,
    }));

    drag.current = { from: index, to: index, startX: e.clientX, el, rects, moved: false };
    el.setPointerCapture(e.pointerId);
    setDragId(tabs[index].id);
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 3) d.moved = true;
    d.el.style.transform = `translateX(${dx}px)`;

    // Centre de l'onglet tiré, rapporté aux positions de départ : on en déduit
    // la place visée.
    const center = d.rects[d.from].left + d.rects[d.from].width / 2 + dx;
    let to = 0;
    d.rects.forEach((r, i) => {
      if (center > r.left + r.width / 2) to = i;
    });
    if (to === d.to) return;
    d.to = to;

    // Décale les voisins pour matérialiser la place libérée.
    const slot = d.rects[d.from].width + 4;
    d.rects.forEach((r, i) => {
      if (i === d.from) return;
      let shift = 0;
      if (d.from < to && i > d.from && i <= to) shift = -slot;
      if (d.from > to && i >= to && i < d.from) shift = slot;
      r.el.style.transition = "transform 180ms cubic-bezier(0.22, 0.9, 0.24, 1)";
      r.el.style.transform = `translateX(${shift}px)`;
    });
  }

  function onPointerUp() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragId(null);

    d.rects.forEach((r) => {
      r.el.style.transform = "";
      r.el.style.transition = "";
    });

    if (!d.moved) select(tabs[d.from].id);
    else if (d.to !== d.from) move(d.from, d.to);
  }

  return (
    <div className="tabbar" ref={barRef} data-more={more || undefined}>
      {/* Hors de la piste : le point d'entrée ne doit jamais défiler hors du
          cadre. Et hors du tablist : ce n'est pas un onglet. */}
      <button
        type="button"
        className="tab-add"
        onClick={onAdd}
        title={t("tabs.add_hint")}
        aria-label={t("tabs.add")}
      >
        +
      </button>

      <div
        className="tabbar-track"
        ref={trackRef}
        role="tablist"
        aria-label={t("tabs.aria_bar")}
      >
        {pill && (
          <span
            className="tabbar-pill"
            aria-hidden="true"
            style={{
              width: `${pill.width}px`,
              transform: `translateX(${pill.left}px)`,
              "--tab-hue": pill.hue,
            }}
          />
        )}

        {tabs.map((tab, index) => {
          // Estompé seulement quand toutes les places sont prises : il est alors
          // réellement le prochain remplacé.
          const doomed = tabs.length >= max && index === tabs.length - 1;
          const isRenaming = renaming === tab.id;
          const isConfirming = confirming === tab.id;

          const title = [
            tab.name,
            t("tabs.tip_lines", { lines: tab.lines?.toLocaleString() }),
            doomed ? t("tabs.tip_doomed") : null,
            t("tabs.tip_rename"),
          ]
            .filter(Boolean)
            .join("\n");

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab.id === activeId}
              data-doomed={doomed || undefined}
              data-dragged={dragId === tab.id || undefined}
              data-confirming={isConfirming || undefined}
              style={{ "--tab-hue": hueVar(tab) }}
              title={isConfirming ? undefined : title}
              onClick={() => !isConfirming && select(tab.id)}
              onDoubleClick={(e) => {
                e.preventDefault();
                if (!isConfirming) setRenaming(tab.id);
              }}
              onKeyDown={(e) => onKeyDown(e, index)}
              onPointerDown={(e) => onPointerDown(e, index)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {isConfirming ? (
                // Supprimer un log est définitif : on demande avant. « Annuler » est
                // à DROITE, là où le curseur vient de cliquer la croix, pour que le
                // geste de trop tombe sur l'issue inoffensive.
                <span className="tab-confirm" role="group" aria-label={t("tabs.confirm_aria")}>
                  {/* La pastille reste : on doit voir DE QUEL log on parle. */}
                  <span className="tab-dot" aria-hidden="true" />
                  <span
                    className="tab-confirm-go"
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(tab.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      e.stopPropagation();
                      confirmDelete(tab.id);
                    }}
                  >
                    {t("tabs.confirm_go")}
                  </span>
                  <span
                    className="tab-confirm-no"
                    role="button"
                    tabIndex={0}
                    ref={cancelRef}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirming(null);
                    }}
                  >
                    {t("tabs.confirm_no")}
                  </span>
                </span>
              ) : (
                <>
                  <span className="tab-dot" aria-hidden="true" />

                  {isRenaming ? (
                    <RenameInput
                      value={tab.label || ""}
                      placeholder={tab.autoLabel}
                      onDone={(next) => {
                        setRenaming(null);
                        if ((next || "") !== (tab.label || "")) onRename(tab.id, next);
                      }}
                    />
                  ) : (
                    <span className="tab-label">{tab.tabLabel}</span>
                  )}

                  <span
                    className="tab-close"
                    role="button"
                    tabIndex={-1}
                    aria-label={t("tabs.close", { label: tab.tabLabel })}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      askConfirm(tab.id);
                    }}
                  >
                    ✕
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Champ de renommage. Entrée valide, Échap annule, la perte de focus valide
// aussi (cliquer ailleurs après avoir tapé ne doit pas jeter la saisie).
function RenameInput({ value, placeholder, onDone }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const done = useRef(false);
  const [text, setText] = useState(value);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function finish(keep) {
    if (done.current) return;
    done.current = true;
    onDone(keep ? text : value);
  }

  return (
    <input
      ref={ref}
      className="tab-rename"
      type="text"
      maxLength={MAX_LABEL}
      value={text}
      placeholder={placeholder}
      aria-label={t("tabs.rename_aria", { max: MAX_LABEL })}
      onChange={(e) => setText(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
    />
  );
}
