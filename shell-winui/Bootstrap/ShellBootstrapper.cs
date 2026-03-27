using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml;

namespace CodeXSoundboard.Shell.WinUI.Bootstrap;

internal sealed class ShellBootstrapper : IDisposable
{
    private readonly ServiceProvider _services;

    public ShellBootstrapper()
    {
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddSingleton<ShellLayoutProfile>();
        serviceCollection.AddTransient<MainWindow>();
        _services = serviceCollection.BuildServiceProvider();
    }

    public Window CreateMainWindow()
    {
        return _services.GetRequiredService<MainWindow>();
    }

    public void Dispose()
    {
        _services.Dispose();
    }
}
