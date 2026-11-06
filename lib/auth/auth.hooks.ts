"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  loginUser,
  logoutUser,
} from "./auth.api";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginUser,

    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutUser,

    onSettled: () => {
      queryClient.clear();
    },
  });
}