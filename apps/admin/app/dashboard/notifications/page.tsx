import Header from "../../../components/layout/Header";

export default function NotificationsPage() {
  return (
    <>
      <Header title="Notifications" />
      <main className="flex-1 p-6">
        <div className="text-center py-24 text-muted">
          <p className="text-5xl mb-4">🔔</p>
          <p className="font-semibold text-white text-lg">Coming Soon</p>
          <p className="text-sm mt-1">Platform-wide notification management will appear here.</p>
        </div>
      </main>
    </>
  );
}
