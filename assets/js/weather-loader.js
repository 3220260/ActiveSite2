document.addEventListener("DOMContentLoaded", function () {
    const weatherPills = document.querySelectorAll(".menu-weather-pill");

    if (!weatherPills.length) return;

    const weatherUrl =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=37.9838" +
        "&longitude=23.7275" +
        "&current=temperature_2m,weather_code,wind_speed_10m" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
        "&forecast_days=2" +
        "&timezone=Europe%2FAthens";

    function getWeatherText(code) {
        const codes = {
            0: "Καθαρός",
            1: "Αίθριος",
            2: "Μερική συννεφιά",
            3: "Συννεφιά",
            45: "Ομίχλη",
            48: "Ομίχλη",
            51: "Ψιχάλα",
            53: "Ψιχάλα",
            55: "Ψιχάλα",
            61: "Βροχή",
            63: "Βροχή",
            65: "Δυνατή βροχή",
            71: "Χιόνι",
            73: "Χιόνι",
            75: "Χιόνι",
            80: "Μπόρες",
            81: "Μπόρες",
            82: "Δυνατές μπόρες",
            95: "Καταιγίδα",
            96: "Καταιγίδα",
            99: "Ισχυρή καταιγίδα"
        };

        return codes[code] || "Καιρός";
    }

    function getWeatherIcon(code) {
        if (code === 0) return "fa-sun";
        if ([1, 2].includes(code)) return "fa-cloud-sun";
        if ([3, 45, 48].includes(code)) return "fa-cloud";
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "fa-cloud-rain";
        if ([71, 73, 75].includes(code)) return "fa-snowflake";
        if ([95, 96, 99].includes(code)) return "fa-cloud-bolt";
        return "fa-cloud-sun";
    }

    fetch(weatherUrl)
        .then(function (response) {
            if (!response.ok) throw new Error("Weather request failed");
            return response.json();
        })
        .then(function (data) {
            const current = data.current || {};
            const daily = data.daily || {};

            const todayTemp = Math.round(current.temperature_2m);
            const todayCode = Number(current.weather_code);
            const windSpeed = current.wind_speed_10m !== undefined && current.wind_speed_10m !== null
                ? Math.round(current.wind_speed_10m)
                : null;
            const todayText = getWeatherText(todayCode);
            const todayIcon = getWeatherIcon(todayCode);

            const tomorrowMin = daily.temperature_2m_min && daily.temperature_2m_min[1] !== undefined
                ? Math.round(daily.temperature_2m_min[1])
                : null;

            const tomorrowMax = daily.temperature_2m_max && daily.temperature_2m_max[1] !== undefined
                ? Math.round(daily.temperature_2m_max[1])
                : null;

            const tomorrowCode = daily.weather_code && daily.weather_code[1] !== undefined
                ? Number(daily.weather_code[1])
                : null;

            const tomorrowText = tomorrowCode !== null
                ? getWeatherText(tomorrowCode)
                : "Καιρός";

            weatherPills.forEach(function (pill) {
                const icon = pill.querySelector("i");
                const todayEl = pill.querySelector(".menu-weather-today");
                const tomorrowEl = pill.querySelector(".menu-weather-tomorrow");
                const extraEl = pill.querySelector(".menu-weather-extra");

                if (icon) {
                    icon.className = "fa-solid " + todayIcon;
                    icon.setAttribute("aria-hidden", "true");
                }

                if (todayEl) {
                    todayEl.textContent = "Σήμερα: " + todayTemp + "°C · " + todayText;
                }

                if (tomorrowEl) {
                    tomorrowEl.textContent =
                        tomorrowMin !== null && tomorrowMax !== null
                            ? "Αύριο: " + tomorrowMin + "° / " + tomorrowMax + "° · " + tomorrowText
                            : "Αύριο: Καιρός Αθήνα";
                }

                if (extraEl) {
                    extraEl.textContent = windSpeed !== null
                        ? "Άνεμος: " + windSpeed + " km/h"
                        : "Άνεμος: -- km/h";
                }

                pill.setAttribute(
                    "title",
                    "Σήμερα: " + todayTemp + "°C, " + todayText + " | Αύριο: " +
                    (tomorrowMin !== null && tomorrowMax !== null
                        ? tomorrowMin + "° / " + tomorrowMax + "°, " + tomorrowText
                        : "Καιρός Αθήνας")
                );
            });
        })
        .catch(function () {
            weatherPills.forEach(function (pill) {
                const todayEl = pill.querySelector(".menu-weather-today");
                const tomorrowEl = pill.querySelector(".menu-weather-tomorrow");
                const extraEl = pill.querySelector(".menu-weather-extra");

                if (todayEl) todayEl.textContent = "Σήμερα: Καιρός Αθήνα";
                if (tomorrowEl) tomorrowEl.textContent = "Αύριο: --° / --°";
                if (extraEl) extraEl.textContent = "Άνεμος: -- km/h";
            });
        });
});
