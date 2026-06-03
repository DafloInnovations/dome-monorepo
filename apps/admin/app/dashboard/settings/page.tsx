import Header from "../../../components/layout/Header";

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" />
      <main className="flex-1 p-6">
        <div className="text-center py-24 text-muted">
          <p className="text-5xl mb-4">⚙️</p>
          <p className="font-semibold text-white text-lg">Coming Soon</p>
          <p className="text-sm mt-1">Platform settings and configuration will appear here.</p>
        </div>
      </main>
    </>
  );
}
