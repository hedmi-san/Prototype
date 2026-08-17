package dz.company.distributor.security;

import dz.company.distributor.common.exception.UnauthorizedAccessException;
import dz.company.distributor.users.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static CustomUserDetails getCurrentUserDetails() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetails) {
            return (CustomUserDetails) authentication.getPrincipal();
        }
        return null;
    }

    public static Long getCurrentUserId() {
        CustomUserDetails userDetails = getCurrentUserDetails();
        return userDetails != null ? userDetails.getId() : null;
    }

    public static String getCurrentUsername() {
        CustomUserDetails userDetails = getCurrentUserDetails();
        return userDetails != null ? userDetails.getUsername() : "SYSTEM";
    }

    public static String getCurrentUserRole() {
        CustomUserDetails userDetails = getCurrentUserDetails();
        return userDetails != null ? userDetails.getRole() : null;
    }

    public static Long getCurrentUserWarehouseId() {
        CustomUserDetails userDetails = getCurrentUserDetails();
        return userDetails != null ? userDetails.getWarehouseId() : null;
    }

    public static boolean isAdmin() {
        String role = getCurrentUserRole();
        return "ADMIN".equals(role);
    }

    public static boolean isSuperManager() {
        String role = getCurrentUserRole();
        return "SUPER_MANAGER".equals(role);
    }

    public static void validateAdmin() {
        if (!isAdmin()) {
            throw new UnauthorizedAccessException("Administrator privileges required for this operation");
        }
    }

    public static void validateWarehouseAccess(Long warehouseId) {
        if (warehouseId == null) {
            return;
        }
        CustomUserDetails user = getCurrentUserDetails();
        if (user == null) {
            return;
        }
        String role = user.getRole();
        if ("ADMIN".equals(role) || "SUPER_MANAGER".equals(role)) {
            return;
        }

        Long userWarehouseId = user.getWarehouseId();
        if (userWarehouseId == null || !userWarehouseId.equals(warehouseId)) {
            throw new UnauthorizedAccessException(
                    String.format("User does not have permission to access warehouse ID %d", warehouseId)
            );
        }
    }

    public static User getCurrentUser() {
        return getCurrentUserEntity();
    }

    public static User getCurrentUserEntity() {
        CustomUserDetails details = getCurrentUserDetails();
        if (details == null) {
            return null;
        }
        User user = new User();
        user.setId(details.getId());
        user.setUsername(details.getUsername());
        user.setFullName(details.getFullName());
        return user;
    }
}
