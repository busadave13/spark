using {projectName}.Models;

namespace {projectName}.Services;

public interface IWeatherForecastService
{
    Task<IReadOnlyList<WeatherForecastResponse>> GetForecastAsync(CancellationToken cancellationToken);
}
