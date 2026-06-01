module.exports = async function handler(request, response) {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");

    const weatherUrl =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=37.9838" +
        "&longitude=23.7275" +
        "&current=temperature_2m,weather_code,wind_speed_10m" +
        "&timezone=Europe%2FAthens";

    function getWeatherText(code) {
        const codes = {
            0: "Καθαρός",
            1: "Κυρίως αίθριος",
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
            75: "Χιονόπτωση",
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

    try {
        const weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) {
            throw new Error("Weather API failed");
        }

        const data = await weatherResponse.json();
        const current = data.current || {};

        const temperature = Math.round(current.temperature_2m);
        const weatherCode = Number(current.weather_code);
        const wind = Math.round(current.wind_speed_10m || 0);

        response.status(200).json({
            ok: true,
            location: "Αθήνα",
            temperature: temperature,
            text: getWeatherText(weatherCode),
            icon: getWeatherIcon(weatherCode),
            wind: wind
        });
    } catch (error) {
        response.status(200).json({
            ok: false,
            location: "Αθήνα",
            temperature: null,
            text: "Καιρός",
            icon: "fa-cloud-sun",
            wind: null
        });
    }
};