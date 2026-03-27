using CodeXSoundboard.Shell.WinUI.Bootstrap;
using Microsoft.UI.Xaml;
using System;
using System.Threading.Tasks;

namespace CodeXSoundboard.Shell.WinUI;

public partial class App : Application
{
    private readonly ShellBootstrapper _bootstrapper;
    private Window? _mainWindow;

    public App()
    {
        InitializeComponent();
        _bootstrapper = new ShellBootstrapper();
        UnhandledException += OnUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnCurrentDomainUnhandledException;
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;
        AppLogging.Write("App initialized.");
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        AppLogging.Write("OnLaunched start.");
        _mainWindow = _bootstrapper.CreateMainWindow();
        _mainWindow.Activate();
        AppLogging.Write("Main window activated.");
    }

    private void OnUnhandledException(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        AppLogging.Write($"XAML unhandled exception: {e.Message}");
    }

    private void OnCurrentDomainUnhandledException(object? sender, System.UnhandledExceptionEventArgs e)
    {
        if (e.ExceptionObject is Exception exception)
        {
            AppLogging.WriteException("AppDomain unhandled exception", exception);
            return;
        }

        AppLogging.Write($"AppDomain unhandled exception: {e.ExceptionObject}");
    }

    private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        AppLogging.WriteException("Unobserved task exception", e.Exception);
        e.SetObserved();
    }
}
