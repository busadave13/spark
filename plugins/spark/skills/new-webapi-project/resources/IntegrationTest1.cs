using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace {projectName}.IntegrationTests;

public class IntegrationTest1
{
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task GetWeatherForecastReturnsOkStatusCode()
    {
        // Arrange
        var cancellationToken = CancellationToken.None;

        var appHost = await DistributedApplicationTestingBuilder
            .CreateAsync<Projects.{appHostProjectTypeName}>(cancellationToken);

        appHost.Services.AddLogging(logging =>
        {
            logging.SetMinimumLevel(LogLevel.Debug);
            logging.AddFilter(appHost.Environment.ApplicationName, LogLevel.Debug);
            logging.AddFilter("Aspire.", LogLevel.Debug);
        });

        appHost.Services.ConfigureHttpClientDefaults(clientBuilder =>
        {
            clientBuilder.AddStandardResilienceHandler();
        });

        await using var app = await appHost.BuildAsync(cancellationToken)
            .WaitAsync(DefaultTimeout, cancellationToken);
        await app.StartAsync(cancellationToken)
            .WaitAsync(DefaultTimeout, cancellationToken);

        // Act
        using var httpClient = app.CreateHttpClient("{projectNameLowerCase}");

        await app.ResourceNotifications.WaitForResourceHealthyAsync(
            "{projectNameLowerCase}", cancellationToken)
            .WaitAsync(DefaultTimeout, cancellationToken);

        using var response = await httpClient.GetAsync("/weatherforecast", cancellationToken);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetWeatherForecastReturnsForecastPayload()
    {
        // Arrange
        var cancellationToken = CancellationToken.None;

        var appHost = await DistributedApplicationTestingBuilder
            .CreateAsync<Projects.{appHostProjectTypeName}>(cancellationToken);

        appHost.Services.AddLogging(logging =>
        {
            logging.SetMinimumLevel(LogLevel.Debug);
            logging.AddFilter(appHost.Environment.ApplicationName, LogLevel.Debug);
            logging.AddFilter("Aspire.", LogLevel.Debug);
        });

        appHost.Services.ConfigureHttpClientDefaults(clientBuilder =>
        {
            clientBuilder.AddStandardResilienceHandler();
        });

        await using var app = await appHost.BuildAsync(cancellationToken)
            .WaitAsync(DefaultTimeout, cancellationToken);
        await app.StartAsync(cancellationToken)
            .WaitAsync(DefaultTimeout, cancellationToken);

        using var httpClient = app.CreateHttpClient("{projectNameLowerCase}");

        await app.ResourceNotifications.WaitForResourceHealthyAsync(
            "{projectNameLowerCase}", cancellationToken)
            .WaitAsync(DefaultTimeout, cancellationToken);

        // Act
        var forecast = Assert.IsType<JsonElement[]>(
            await httpClient.GetFromJsonAsync<JsonElement[]>("/weatherforecast", cancellationToken));

        // Assert
        Assert.Equal(5, forecast.Length);
        Assert.All(forecast, item =>
        {
            Assert.True(item.TryGetProperty("summary", out var summary));
            Assert.False(string.IsNullOrWhiteSpace(summary.GetString()));
        });
    }
}
