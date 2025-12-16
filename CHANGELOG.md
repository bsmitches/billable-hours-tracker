# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-15

### Changed

- **Clients are now global across all users.** Previously, users could only see and manage clients they created. Now, all clients are visible and manageable by all authenticated users in the application.

- **Work entries can be logged for any client.** Users can now create work entries for any client in the system, not just clients they created.

- **Reports aggregate data from all users.** Client reports now show work entries from all users, providing a complete view of billable hours per client across the entire organization.

### Technical Details

- Removed `user_email` filtering from client CRUD operations (GET, PUT, DELETE) in the backend API
- Updated work entry creation/update endpoints to validate client existence without user ownership checks
- Updated report generation to aggregate work entries from all users for a given client
- Added `user_email` field to frontend Client type for reference (tracks who created the client)
- Error messages simplified from "Client not found or does not belong to user" to "Client not found"

### Notes

- Work entries themselves remain user-specific on the Work Entries page (users only see their own work entries)
- The `user_email` field is retained in the database for tracking who originally created each client
