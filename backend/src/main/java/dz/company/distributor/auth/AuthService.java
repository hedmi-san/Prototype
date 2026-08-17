package dz.company.distributor.auth;

import dz.company.distributor.auth.dto.LoginRequest;
import dz.company.distributor.auth.dto.LoginResponse;
import dz.company.distributor.auth.dto.UserProfileResponse;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.security.CustomUserDetails;
import dz.company.distributor.security.JwtService;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.users.User;
import dz.company.distributor.users.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public AuthService(
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    public LoginResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        String token = jwtService.generateToken(userDetails);

        return new LoginResponse(
                token,
                userDetails.getId(),
                userDetails.getUsername(),
                userDetails.getFullName(),
                userDetails.getRole(),
                userDetails.getWarehouseId(),
                userDetails.getWarehouseName()
        );
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getCurrentUserProfile() {
        Long userId = SecurityUtils.getCurrentUserId();
        if (userId == null) {
            throw new ResourceNotFoundException("No authenticated user profile found");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getRole().getName(),
                user.getWarehouse() != null ? user.getWarehouse().getId() : null,
                user.getWarehouse() != null ? user.getWarehouse().getName() : null
        );
    }
}
