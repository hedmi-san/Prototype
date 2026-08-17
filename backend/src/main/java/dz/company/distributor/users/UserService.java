package dz.company.distributor.users;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.BusinessException;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.users.dto.CreateUserRequest;
import dz.company.distributor.users.dto.UserDto;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final WarehouseRepository warehouseRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            WarehouseRepository warehouseRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.warehouseRepository = warehouseRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return mapToDto(user);
    }

    @Transactional
    public UserDto createUser(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("Username already exists: " + request.getUsername());
        }

        Role role = roleRepository.findByName(request.getRoleName())
                .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + request.getRoleName()));

        Warehouse warehouse = null;
        if (request.getWarehouseId() != null) {
            warehouse = warehouseRepository.findById(request.getWarehouseId())
                    .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found: " + request.getWarehouseId()));
        }

        User user = new User(
                request.getUsername(),
                passwordEncoder.encode(request.getPassword()),
                request.getFullName(),
                role,
                warehouse,
                true
        );
        User saved = userRepository.save(user);

        auditService.logAction(
                "USER_CREATED",
                "USER",
                saved.getId(),
                warehouse,
                null,
                saved.getUsername() + " (" + role.getName() + ")",
                "Created user account " + saved.getUsername()
        );

        return mapToDto(saved);
    }

    public UserDto mapToDto(User user) {
        return new UserDto(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getRole().getName(),
                user.getWarehouse() != null ? user.getWarehouse().getId() : null,
                user.getWarehouse() != null ? user.getWarehouse().getName() : null,
                user.isActive(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
