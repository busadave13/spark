using {projectName}.Models;

namespace {projectName}.Services;

public sealed class WeatherForecastService : IWeatherForecastService
{
    private static readonly string[] Summaries =
    [
        "Freezing",
        "Bracing",
        "Chilly",
        "Cool",
        "Mild",
        "Warm",
        "Balmy",
        "Hot",
        "Sweltering",
        "Scorching"
    ];

    public Task<IReadOnlyList<WeatherForecastResponse>> GetForecastAsync(CancellationToken cancellationToken)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            return Task.FromCanceled<IReadOnlyList<WeatherForecastResponse>>(cancellationToken);
        }

        IReadOnlyList<WeatherForecastResponse> forecast = Enumerable.Range(1, 5)
            .Select(index => new WeatherForecastResponse(
                DateOnly.FromDateTime(DateTime.UtcNow.AddDays(index)),
                Random.Shared.Next(-20, 55),
                Summaries[Random.Shared.Next(Summaries.Length)]))
            .ToArray();

        return Task.FromResult(forecast);
    }
}
