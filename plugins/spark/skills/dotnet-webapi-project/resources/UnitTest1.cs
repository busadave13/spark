using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using {projectName}.Models;

namespace {projectName}.UnitTests;

public class UnitTest1 : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public UnitTest1(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetWeatherForecast_ReturnsOkStatusCode()
    {
        // Act
        var response = await _client.GetAsync("/weatherforecast");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetWeatherForecast_ReturnsJsonContent()
    {
        // Act
        var response = await _client.GetAsync("/weatherforecast");

        // Assert
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task GetWeatherForecast_ReturnsFiveForecastEntries()
    {
        // Act
        var forecast = Assert.IsType<List<WeatherForecastResponse>>(
            await _client.GetFromJsonAsync<List<WeatherForecastResponse>>("/weatherforecast"));

        // Assert
        Assert.Equal(5, forecast.Count);
        Assert.All(forecast, item => Assert.False(string.IsNullOrWhiteSpace(item.Summary)));
    }
}
