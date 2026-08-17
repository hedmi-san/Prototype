package dz.company.distributor.users.dto;

import jakarta.validation.constraints.NotBlank;

public class CreateUserRequest {

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Password is required")
    private String password;

    @NotBlank(message = "Full name is required")
    private String fullName;

    @NotBlank(message = "Role name is required (ADMIN, MANAGER, SUPER_MANAGER, ACCOUNTANT)")
    private String roleName;

    private Long warehouseId;

    public CreateUserRequest() {}

    public CreateUserRequest(String username, String password, String fullName, String roleName, Long warehouseId) {
        this.username = username;
        this.password = password;
        this.fullName = fullName;
        this.roleName = roleName;
        this.warehouseId = warehouseId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getRoleName() {
        return roleName;
    }

    public void setRoleName(String roleName) {
        this.roleName = roleName;
    }

    public Long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(Long warehouseId) {
        this.warehouseId = warehouseId;
    }
}
