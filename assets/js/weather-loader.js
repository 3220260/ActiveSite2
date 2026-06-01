document.addEventListener("DOMContentLoaded", function () {
    const weatherPills = document.querySelectorAll(".menu-weather-pill");

    if (!weatherPills.length) return;

    fetch("/api/weather-athens")
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Weather request failed");
            }

            return response.json();
        })
        .then(function (data) {
            const tempText = data.temperature !== null
                ? data.temperature + "°C"
                : "Καιρός";

            const label = data.ok
                ? tempText + " Αθήνα"
                : "Καιρός Αθήνα";

            weatherPills.forEach(function (pill) {
                const icon = pill.querySelector("i");
                const text = pill.querySelector(".menu-weather-text");
                const small = pill.querySelector("small");

                if (icon && data.icon) {
                    icon.className = "fa-solid " + data.icon;
                    icon.setAttribute("aria-hidden", "true");
                }

                if (text) {
                    text.textContent = label;
                }

                if (small && data.text) {
                    small.textContent = data.text;
                }

                pill.setAttribute(
                    "title",
                    data.ok
                        ? data.text + " στην Αθήνα" + (data.wind !== null ? " • Άνεμος " + data.wind + " km/h" : "")
                        : "Καιρός Αθήνας"
                );
            });
        })
        .catch(function () {
            weatherPills.forEach(function (pill) {
                const text = pill.querySelector(".menu-weather-text");
                const small = pill.querySelector("small");

                if (text) text.textContent = "Καιρός Αθήνα";
                if (small) small.textContent = "";
            });
        });
});