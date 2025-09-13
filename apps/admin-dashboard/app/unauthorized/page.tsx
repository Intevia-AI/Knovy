export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Not Authorized</h1>
      <p className="text-muted-foreground">You do not have permission to view this page.</p>
    </div>
  );
}
