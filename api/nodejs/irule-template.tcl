# BlueGreen v{{version}}

proc get_datagroup_value {dg_name vs_full_path} {
    set dg [class get $dg_name]
    foreach x $dg {
        if { $x starts_with $vs_full_path} {
            return $x
            break
        }
    }
}

proc get_cookie_name {vs_full_path} {
    return "{{cookiePrefix}}[string map "/ _" $vs_full_path]"
}

proc validate_pool {requested_pool blue_pool green_pool} {
    set valid_pools [list $blue_pool $green_pool]
    if {[lsearch $valid_pools $requested_pool] != -1} {
        return $requested_pool
    } else {
        # if requested pool isn't either blue or green, return blue.
        return [lindex $valid_pools 0]
    }
}

proc debug_log {flag message} {
    if { $flag } { log local0. $message }
}

when CLIENT_ACCEPTED {
    set DEBUG 0
    set cookie_expiration_seconds 1200
}

when HTTP_REQUEST {
    # Use this to set the cookie name as well as to look up the distribution and pool name settings from the datagroup
    set traffic_dist_rule [call get_datagroup_value "{{dataGroup}}" [virtual name]]
    set fields [split $traffic_dist_rule ","]
    set vs [lindex $fields 0]
    set distribution [lindex $fields 1]
    set blue_pool [lindex $fields 2]
    set green_pool [lindex $fields 3]
    set blue_green_cookie [call get_cookie_name $vs]
    set cookie_exists [HTTP::cookie exists $blue_green_cookie]
    call debug_log $DEBUG "distribution: $distribution"

    switch -- $distribution {
        "0" {
            pool $green_pool
            call debug_log $DEBUG "defaulting to green pool"
            set remove_cookie 1
        }
        
        "1" {
            pool $blue_pool
            call debug_log $DEBUG "defaulting to blue pool"
            set remove_cookie 1
        }
    
        default {
            # Check if there is a pool selector cookie in the request
            if { $cookie_exists } {
                # Make sure that the pool in the cookie is one of either blue or green pools. Prevent the client from using an undesired pool.
                set pool_name [call validate_pool [HTTP::cookie $blue_green_cookie] $blue_pool $green_pool]
                call debug_log $DEBUG "validated pool: $pool_name"
                pool $pool_name
                set cookie_value_to_set ""
            } else {
                # No pool selector cookie, so choose a pool based on the datagroup distribution
                set rand [expr { rand() }]
                if { $rand < $distribution } { 
                    pool $blue_pool
                    set cookie_value_to_set $blue_pool
                } else {
                    pool $green_pool
                    set cookie_value_to_set $green_pool
                }
            }
        }
    }
}

when HTTP_RESPONSE {
    # Set a pool selector cookie from the pool that was was selected for this request
    if {[info exists cookie_value_to_set] && $cookie_value_to_set ne ""}{
        call debug_log $DEBUG "inserting cookie"
        HTTP::cookie insert name $blue_green_cookie value $cookie_value_to_set path "/"
        HTTP::cookie expires $blue_green_cookie $cookie_expiration_seconds relative
    } elseif {$cookie_exists && [info exists remove_cookie] } {
        unset -- remove_cookie
        # If there is no need to store a selected pool in a cookie, remove any previously stored blue-green cookie for this vs
        call debug_log $DEBUG "removing cookie $blue_green_cookie"
        HTTP::header insert Set-Cookie "$blue_green_cookie=deleted;expires=Thu, 01 Jan 1970 00:00:00 GMT"
    }
}