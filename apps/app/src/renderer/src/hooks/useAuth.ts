/**
 * @fileoverview Re-export of useAuth from AuthContext for backward compatibility.
 * All auth logic has been moved to AuthContext to eliminate excessive network requests.
 */

// Re-export useAuth from the centralized AuthContext
export { useAuth } from '../context/AuthContext'