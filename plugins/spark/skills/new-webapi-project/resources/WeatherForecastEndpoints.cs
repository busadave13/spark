using {projectName}.Services;

namespace {projectName}.Endpoints;

public static class WeatherForecastEndpoints
{
    public static void MapWeatherForecastEndpoints(this WebApplication app)
    {
        app.MapGet("/weatherforecast", async (IWeatherForecastService service, CancellationToken cancellationToken) =>
            {
                var forecast = await service.GetForecastAsync(cancellationToken);
                return Results.Ok(forecast);
            })
            .WithName("GetWeatherForecast");
    }
}
