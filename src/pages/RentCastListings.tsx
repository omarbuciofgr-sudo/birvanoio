import DashboardLayout from "@/components/dashboard/DashboardLayout";
import RentCastListingsContent from "@/components/rentcast/RentCastListingsContent";

/** Standalone RentCast page — /dashboard/rentcast redirects to Scout; kept for direct import. */
export default function RentCastListings() {
  return (
    <DashboardLayout fullWidth>
      <RentCastListingsContent />
    </DashboardLayout>
  );
}
