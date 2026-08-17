package dz.company.distributor.auth.dto;

public class LoginResponse {
    private String token;
    private String type = "Bearer";
    private Long id;
    private String username;
    private String fullName;
    private String role;
    private Long warehouseId;
    private String warehouseName;

    public LoginResponse() {
    }

    public LoginResponse(String token, Long id, String username, String fullName,
                         String role, Long warehouseId, String warehouseName) {
        this.token = token;
        this.id = id;
        this.username = username;
        this.fullName = fullName;
        this.role = role;
        this.warehouseId = warehouseId;
        this.warehouseName = warehouseName;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(Long warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getWarehouseName() {
        return warehouseName;
    }

    public void setWarehouseName(String warehouseName) {
        this.warehouseName = warehouseName;
    }
}
