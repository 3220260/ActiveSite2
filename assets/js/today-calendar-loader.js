document.addEventListener("DOMContentLoaded", function () {
    const infoEls = document.querySelectorAll(".today-nameday");
    const pillEls = document.querySelectorAll(".menu-name-day-pill");

    if (!infoEls.length) return;

    const today = new Date();
    const year = String(today.getFullYear());

    const key =
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");

    function mergeDay(baseDay, yearDay) {
        const result = {
            namedays: [],
            worldDays: [],
            history: []
        };

        [baseDay, yearDay].forEach(function (day) {
            if (!day) return;

            ["namedays", "worldDays", "history"].forEach(function (field) {
                if (Array.isArray(day[field])) {
                    day[field].forEach(function (item) {
                        if (item && !result[field].includes(item)) {
                            result[field].push(item);
                        }
                    });
                }
            });
        });

        return result;
    }

    function shortNames(names, max) {
        if (!names || !names.length) return "";

        const visible = names.slice(0, max);
        const extra = names.length - visible.length;

        return visible.join(", ") + (extra > 0 ? " +" + extra : "");
    }

    fetch("assets/data/today-calendar.json?v=20260601")
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Could not load today-calendar.json");
            }

            return response.json();
        })
        .then(function (calendar) {
            const baseDay =
                calendar.days && calendar.days[key]
                    ? calendar.days[key]
                    : null;

            const yearDay =
                calendar.yearSpecific &&
                calendar.yearSpecific[year] &&
                calendar.yearSpecific[year][key]
                    ? calendar.yearSpecific[year][key]
                    : null;

            const day = mergeDay(baseDay, yearDay);

            let menuText = "Ποιοι γιορτάζουν σήμερα";

            if (day.namedays.length) {
                menuText = "Γιορτάζουν: " + shortNames(day.namedays, 3);
            } else if (day.worldDays.length) {
                menuText = day.worldDays[0];
            } else if (day.history.length) {
                menuText = "Σαν σήμερα: " + day.history[0];
            }

            const tooltipParts = [];

            if (day.namedays.length) {
                tooltipParts.push("Γιορτάζουν: " + day.namedays.join(", "));
            }

            if (day.worldDays.length) {
                tooltipParts.push("Σήμερα: " + day.worldDays.join(" • "));
            }

            if (day.history.length) {
                tooltipParts.push("Σαν σήμερα: " + day.history.join(" • "));
            }

            const tooltip = tooltipParts.length
                ? tooltipParts.join("\n")
                : "Δεν υπάρχει καταχώρηση για σήμερα.";

            infoEls.forEach(function (el) {
                el.textContent = menuText;
            });

            pillEls.forEach(function (el) {
                el.setAttribute("title", tooltip);
                el.setAttribute("aria-label", tooltip);
            });
        })
        .catch(function () {
            infoEls.forEach(function (el) {
                el.textContent = "Γιορτάζουν σήμερα";
            });
        });
});